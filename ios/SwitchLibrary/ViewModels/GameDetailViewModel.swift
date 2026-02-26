import Foundation

// MARK: - Game Detail ViewModel

/// Manages state for viewing a single game's details and related recommendations.
@MainActor
final class GameDetailViewModel: ObservableObject {
    @Published var game: APIGame?
    @Published var recommendations: [APIGame] = []
    @Published var isLoading = false
    @Published var isLoadingRecommendations = false
    @Published var errorMessage: String?

    private let gameId: Int

    init(gameId: Int, game: APIGame? = nil) {
        self.gameId = gameId
        self.game = game
    }

    /// Loads the full game details from the API.
    func loadGame() async {
        guard game == nil else {
            await loadRecommendations()
            return
        }

        guard await APIService.shared.isConfigured else {
            errorMessage = "API is not configured."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            game = try await APIService.shared.getGame(id: gameId)
            await loadRecommendations()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    /// Loads similar game recommendations.
    func loadRecommendations() async {
        guard await APIService.shared.isConfigured else { return }

        isLoadingRecommendations = true

        do {
            recommendations = try await APIService.shared.getRecommendations(for: gameId)
        } catch {
            // Non-critical: silently ignore recommendation failures
            recommendations = []
        }

        isLoadingRecommendations = false
    }
}
