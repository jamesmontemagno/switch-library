import Foundation

// MARK: - Search API Response Models

/// Game data returned from the Azure Functions SQL API.
struct APIGame: Codable, Identifiable, Equatable {
    let id: Int
    let gameTitle: String
    let releaseDate: String?
    let platform: Int
    let platformName: String?
    let regionId: Int?
    let players: Int?
    let overview: String?
    let rating: String?
    let coop: String?
    let youtube: String?
    let alternates: [String]?
    let genres: [APILookupItem]?
    let developers: [APILookupItem]?
    let publishers: [APILookupItem]?
    let boxart: APIBoxart?

    /// Returns the best available cover image URL.
    var coverImageURL: URL? {
        guard let boxart else { return nil }
        let urlString = boxart.thumb ?? boxart.small ?? boxart.medium ?? boxart.large ?? boxart.original
        guard let urlString else { return nil }
        return URL(string: urlString)
    }

    /// Returns a display-friendly platform name.
    var platformDisplayName: String {
        if let platformName, !platformName.isEmpty {
            return platformName
        }
        switch platform {
        case 4971: return "Nintendo Switch"
        case 5021: return "Nintendo Switch 2"
        default: return "Unknown Platform"
        }
    }

    /// Formats the release date for display.
    var formattedReleaseDate: String? {
        guard let releaseDate, !releaseDate.isEmpty else { return nil }
        let inputFormatter = DateFormatter()
        inputFormatter.dateFormat = "yyyy-MM-dd"
        guard let date = inputFormatter.date(from: releaseDate) else { return releaseDate }
        let outputFormatter = DateFormatter()
        outputFormatter.dateStyle = .medium
        return outputFormatter.string(from: date)
    }

    static func == (lhs: APIGame, rhs: APIGame) -> Bool {
        lhs.id == rhs.id
    }
}

struct APILookupItem: Codable, Identifiable, Equatable {
    let id: Int
    let name: String
}

struct APIBoxart: Codable, Equatable {
    let filename: String?
    let original: String?
    let small: String?
    let thumb: String?
    let croppedCenterThumb: String?
    let medium: String?
    let large: String?
}

// MARK: - Search Result

struct APISearchResult: Codable {
    let games: [APIGame]
    let totalCount: Int
    let page: Int
    let pageSize: Int
    let totalPages: Int
}

// MARK: - Bulk Games Response

struct APIBulkResponse: Codable {
    let found: [APIGame]
    let notFound: [Int]
    let foundCount: Int
    let notFoundCount: Int
}

// MARK: - Recommendations Response

struct APIRecommendationsResponse: Codable {
    let sourceGameId: Int
    let recommendations: [APIGame]
    let count: Int
}

// MARK: - Upcoming Games Response (same shape as search)

typealias APIUpcomingResult = APISearchResult

// MARK: - Database Stats

struct APIDatabaseStats: Codable {
    let totalGames: Int?
    let switchGames: Int?
    let switch2Games: Int?
    let totalGenres: Int?
    let totalDevelopers: Int?
    let totalPublishers: Int?
    let lastSyncTime: String?
    let syncType: String?
    let gamesSynced: Int?
    let gamesWithBoxart: Int?
    let gamesWithOverview: Int?
    let averageRating: Double?
    let gamesWithCoop: Int?
}

// MARK: - User / Auth Models

struct AppUser: Identifiable, Equatable {
    let id: String
    let email: String?
    let displayName: String
    let avatarUrl: String?
}

// MARK: - Region Mapping

enum GameRegion {
    // TheGamesDB uses region IDs 1 and 2 for different North American sub-regions
    static let names: [Int: String] = [
        0: "Global",
        1: "North America",
        2: "North America",
        3: "Japan",
        4: "Australia",
        5: "Asia",
        6: "Europe",
        7: "South America",
        8: "Africa",
        9: "Middle East",
    ]

    static func name(for regionId: Int?) -> String {
        guard let regionId else { return "Unknown" }
        return names[regionId] ?? "Region \(regionId)"
    }
}
