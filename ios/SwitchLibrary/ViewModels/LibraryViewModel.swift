import Foundation

// MARK: - Library ViewModel

/// Manages the user's game library state including loading, filtering, and sorting.
@MainActor
final class LibraryViewModel: ObservableObject {
    @Published var games: [GameEntry] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var searchText = ""
    @Published var selectedStatus: GameStatus?
    @Published var selectedPlatform: GamePlatform?
    @Published var sortOrder: SortOrder = .titleAscending

    enum SortOrder: String, CaseIterable, Identifiable {
        case titleAscending = "Title (A-Z)"
        case titleDescending = "Title (Z-A)"
        case dateAdded = "Recently Added"
        case platformName = "Platform"

        var id: String { rawValue }
    }

    /// Filtered and sorted games based on current filters.
    var filteredGames: [GameEntry] {
        var result = games

        if !searchText.isEmpty {
            let query = searchText.lowercased()
            result = result.filter { $0.title.lowercased().contains(query) }
        }

        if let selectedStatus {
            result = result.filter { $0.status == selectedStatus }
        }

        if let selectedPlatform {
            result = result.filter { $0.platform == selectedPlatform }
        }

        switch sortOrder {
        case .titleAscending:
            result.sort { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        case .titleDescending:
            result.sort { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedDescending }
        case .dateAdded:
            result.sort { $0.createdAt > $1.createdAt }
        case .platformName:
            result.sort {
                if $0.platform == $1.platform {
                    return $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
                }
                return $0.platform.rawValue < $1.platform.rawValue
            }
        }

        return result
    }

    /// Summary counts for display.
    var totalCount: Int { games.count }
    var ownedCount: Int { games.filter { $0.status == .owned }.count }
    var wishlistCount: Int { games.filter { $0.status == .wishlist }.count }
    var favoriteCount: Int { games.filter { $0.isFavorite == true }.count }

    /// Loads games from Supabase or local storage.
    func loadGames() async {
        isLoading = true
        errorMessage = nil

        do {
            games = try await SupabaseService.shared.loadGames()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    /// Deletes a game from the library.
    func deleteGame(_ game: GameEntry) async {
        do {
            try await SupabaseService.shared.deleteGame(id: game.id)
            games.removeAll { $0.id == game.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Toggles the favorite status of a game.
    func toggleFavorite(_ game: GameEntry) async {
        guard let index = games.firstIndex(where: { $0.id == game.id }) else { return }
        var updated = games[index]
        updated.isFavorite = !(updated.isFavorite ?? false)
        updated.updatedAt = ISO8601DateFormatter().string(from: Date())

        do {
            let saved = try await SupabaseService.shared.saveGame(updated)
            games[index] = saved
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Updates a game in the local array after editing.
    func updateGame(_ game: GameEntry) {
        if let index = games.firstIndex(where: { $0.id == game.id }) {
            games[index] = game
        }
    }

    /// Inserts a newly added game at the beginning of the list.
    func addGame(_ game: GameEntry) {
        games.insert(game, at: 0)
    }
}
