import Foundation

// MARK: - Search ViewModel

/// Manages game search state using the Azure Functions API.
@MainActor
final class SearchViewModel: ObservableObject {
    @Published var searchText = ""
    @Published var results: [APIGame] = []
    @Published var isSearching = false
    @Published var errorMessage: String?
    @Published var currentPage = 1
    @Published var totalPages = 1
    @Published var totalCount = 0
    @Published var selectedPlatformId: Int?

    private let pageSize = 20

    /// Performs a search with the current query.
    func search() async {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            results = []
            totalCount = 0
            totalPages = 1
            currentPage = 1
            return
        }

        guard await APIService.shared.isConfigured else {
            errorMessage = "API is not configured. Please set the API URL in Settings."
            return
        }

        isSearching = true
        errorMessage = nil
        currentPage = 1
        defer { isSearching = false }

        do {
            let result = try await APIService.shared.searchGames(
                query: query,
                platformId: selectedPlatformId,
                page: currentPage,
                pageSize: pageSize
            )
            results = result.games
            totalCount = result.totalCount
            totalPages = result.totalPages
        } catch {
            errorMessage = error.localizedDescription
            results = []
        }
    }

    /// Loads the next page of results.
    func loadNextPage() async {
        guard currentPage < totalPages, !isSearching else { return }
        guard await APIService.shared.isConfigured else { return }

        isSearching = true
        currentPage += 1
        defer { isSearching = false }

        do {
            let result = try await APIService.shared.searchGames(
                query: searchText.trimmingCharacters(in: .whitespacesAndNewlines),
                platformId: selectedPlatformId,
                page: currentPage,
                pageSize: pageSize
            )
            results.append(contentsOf: result.games)
            totalPages = result.totalPages
        } catch {
            errorMessage = error.localizedDescription
            currentPage -= 1
        }
    }

    /// Clears the search results.
    func clearResults() {
        results = []
        totalCount = 0
        totalPages = 1
        currentPage = 1
        errorMessage = nil
    }
}
