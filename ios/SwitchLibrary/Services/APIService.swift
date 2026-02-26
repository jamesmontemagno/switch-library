import Foundation

// MARK: - API Service

/// Communicates with the Azure Functions backend for game search, details,
/// upcoming releases, and recommendations.
actor APIService {
    static let shared = APIService()

    /// Base URL for the backend API. Configure via Settings.
    var baseURL: String {
        get { UserDefaults.standard.string(forKey: "api_base_url") ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: "api_base_url") }
    }

    private let session: URLSession
    private let decoder: JSONDecoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        session = URLSession(configuration: config)
        decoder = JSONDecoder()
    }

    /// Whether the API is configured with a valid base URL.
    var isConfigured: Bool {
        !baseURL.isEmpty
    }

    // MARK: - Search Games

    /// Searches for games in the SQL database.
    /// - Parameters:
    ///   - query: Search query string.
    ///   - platformId: Optional platform filter.
    ///   - page: Page number (1-based).
    ///   - pageSize: Results per page (max 50).
    /// - Returns: Search results with pagination info.
    func searchGames(
        query: String,
        platformId: Int? = nil,
        page: Int = 1,
        pageSize: Int = 20
    ) async throws -> APISearchResult {
        var components = URLComponents(string: "\(baseURL)/search")!
        var queryItems: [URLQueryItem] = []

        if !query.isEmpty {
            queryItems.append(URLQueryItem(name: "query", value: query))
        }
        if let platformId {
            queryItems.append(URLQueryItem(name: "platformId", value: String(platformId)))
        }
        queryItems.append(URLQueryItem(name: "page", value: String(page)))
        queryItems.append(URLQueryItem(name: "pageSize", value: String(min(pageSize, 50))))

        components.queryItems = queryItems

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        return try await performRequest(url: url)
    }

    // MARK: - Get Game by ID

    /// Retrieves a single game by its database ID.
    func getGame(id: Int) async throws -> APIGame {
        guard let url = URL(string: "\(baseURL)/games/\(id)") else {
            throw APIError.invalidURL
        }
        return try await performRequest(url: url)
    }

    // MARK: - Upcoming Games

    /// Retrieves upcoming game releases.
    /// - Parameters:
    ///   - days: Number of days to look ahead (default 90).
    ///   - platformId: Optional platform filter.
    ///   - page: Page number.
    ///   - pageSize: Results per page.
    func getUpcomingGames(
        days: Int = 90,
        platformId: Int? = nil,
        page: Int = 1,
        pageSize: Int = 20
    ) async throws -> APISearchResult {
        var components = URLComponents(string: "\(baseURL)/upcoming")!
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "days", value: String(days)),
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "pageSize", value: String(min(pageSize, 50))),
        ]
        if let platformId {
            queryItems.append(URLQueryItem(name: "platformId", value: String(platformId)))
        }
        components.queryItems = queryItems

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        return try await performRequest(url: url)
    }

    // MARK: - Recommendations

    /// Gets game recommendations based on a source game.
    func getRecommendations(for gameId: Int, limit: Int = 10) async throws -> [APIGame] {
        guard let url = URL(string: "\(baseURL)/recommendations/\(gameId)?limit=\(min(limit, 20))") else {
            throw APIError.invalidURL
        }

        let response: APIRecommendationsResponse = try await performRequest(url: url)
        return response.recommendations
    }

    // MARK: - Database Stats

    /// Gets public database statistics.
    func getStats() async throws -> APIDatabaseStats {
        guard let url = URL(string: "\(baseURL)/stats") else {
            throw APIError.invalidURL
        }
        return try await performRequest(url: url)
    }

    // MARK: - Private Helpers

    private func performRequest<T: Decodable>(url: URL) async throws -> T {
        let (data, response) = try await session.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            if httpResponse.statusCode == 404 {
                throw APIError.notFound
            }
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }
}

// MARK: - API Errors

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case notFound
    case httpError(statusCode: Int)
    case decodingError(Error)
    case notConfigured

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "The request URL is invalid."
        case .invalidResponse:
            return "Received an invalid response from the server."
        case .notFound:
            return "The requested resource was not found."
        case .httpError(let statusCode):
            return "Server returned an error (HTTP \(statusCode))."
        case .decodingError(let error):
            return "Failed to parse the response: \(error.localizedDescription)"
        case .notConfigured:
            return "The API is not configured. Please set the API URL in Settings."
        }
    }
}
