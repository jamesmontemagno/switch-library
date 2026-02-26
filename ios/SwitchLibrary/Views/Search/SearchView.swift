import SwiftUI

// MARK: - Search View

/// Allows users to search the game database and browse results.
struct SearchView: View {
    @StateObject private var viewModel = SearchViewModel()
    @State private var showingPlatformFilter = false

    var onAddGame: ((APIGame) -> Void)?

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.results.isEmpty && !viewModel.isSearching && viewModel.searchText.isEmpty {
                    EmptyStateView(
                        icon: "magnifyingglass",
                        title: "Search Games",
                        message: "Search the database for Nintendo Switch and Switch 2 games to add to your library."
                    )
                } else if viewModel.results.isEmpty && !viewModel.isSearching {
                    EmptyStateView(
                        icon: "magnifyingglass",
                        title: "No Results",
                        message: "No games found for \"\(viewModel.searchText)\". Try a different search term."
                    )
                } else {
                    resultsList
                }
            }
            .navigationTitle("Search")
            .searchable(
                text: $viewModel.searchText,
                prompt: "Search Switch games…"
            )
            .onSubmit(of: .search) {
                Task { await viewModel.search() }
            }
            .toolbar {
                ToolbarItem(placement: .secondaryAction) {
                    platformFilterMenu
                }
            }
        }
    }

    // MARK: - Results List

    private var resultsList: some View {
        List {
            if let errorMessage = viewModel.errorMessage {
                ErrorBanner(message: errorMessage) {
                    viewModel.errorMessage = nil
                }
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets())
            }

            if viewModel.totalCount > 0 {
                Text("\(viewModel.totalCount) results found")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .listRowSeparator(.hidden)
            }

            ForEach(viewModel.results) { game in
                NavigationLink {
                    GameDetailView(
                        gameId: game.id,
                        game: game,
                        onAddGame: onAddGame
                    )
                } label: {
                    SearchResultRow(game: game)
                }
            }

            if viewModel.currentPage < viewModel.totalPages {
                HStack {
                    Spacer()
                    if viewModel.isSearching {
                        ProgressView()
                    } else {
                        Button("Load More") {
                            Task { await viewModel.loadNextPage() }
                        }
                    }
                    Spacer()
                }
                .listRowSeparator(.hidden)
            }

            if viewModel.isSearching && viewModel.results.isEmpty {
                HStack {
                    Spacer()
                    ProgressView("Searching…")
                    Spacer()
                }
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
    }

    // MARK: - Platform Filter

    private var platformFilterMenu: some View {
        Menu {
            Button("All Platforms") {
                viewModel.selectedPlatformId = nil
                Task { await viewModel.search() }
            }
            Divider()
            ForEach(GamePlatform.allCases) { platform in
                Button {
                    viewModel.selectedPlatformId = platform.platformId
                    Task { await viewModel.search() }
                } label: {
                    HStack {
                        Text(platform.rawValue)
                        if viewModel.selectedPlatformId == platform.platformId {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            Image(systemName: "line.3.horizontal.decrease.circle")
        }
        .accessibilityLabel("Filter by platform")
    }
}
