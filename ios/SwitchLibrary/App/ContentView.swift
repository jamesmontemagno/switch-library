import SwiftUI

// MARK: - Content View

/// The root view with tab-based navigation for the app.
struct ContentView: View {
    @EnvironmentObject var supabase: SupabaseService
    @StateObject private var libraryViewModel = LibraryViewModel()
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            // Library Tab
            LibraryView(viewModel: libraryViewModel)
                .tabItem {
                    Label("Library", systemImage: "books.vertical")
                }
                .tag(0)

            // Search Tab
            SearchView { apiGame in
                addGameFromSearch(apiGame)
            }
            .tabItem {
                Label("Search", systemImage: "magnifyingglass")
            }
            .tag(1)

            // Settings Tab
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(2)
        }
        .task {
            await libraryViewModel.loadGames()
        }
    }

    /// Adds a game from search results to the library.
    private func addGameFromSearch(_ apiGame: APIGame) {
        let userId = supabase.currentUser?.id ?? "local"
        let coverUrl = apiGame.coverImageURL?.absoluteString
        let platform = GamePlatform.from(platformId: apiGame.platform)

        let game = GameEntry.create(
            userId: userId,
            title: apiGame.gameTitle,
            platform: platform,
            format: .physical,
            status: .owned,
            thegamesdbId: apiGame.id,
            coverUrl: coverUrl
        )

        Task {
            do {
                let saved = try await SupabaseService.shared.saveGame(game)
                await MainActor.run {
                    libraryViewModel.addGame(saved)
                    selectedTab = 0 // Switch to library tab
                }
            } catch {
                // Error handling is managed by the SupabaseService
            }
        }
    }
}
