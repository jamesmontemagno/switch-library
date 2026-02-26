import SwiftUI

// MARK: - Library View

/// Displays the user's game collection with filtering, sorting, and search.
struct LibraryView: View {
    @ObservedObject var viewModel: LibraryViewModel
    @State private var showingAddGame = false
    @State private var showingSortOptions = false
    @State private var selectedGame: GameEntry?

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.games.isEmpty {
                    ProgressView("Loading library…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.games.isEmpty {
                    EmptyStateView(
                        icon: "books.vertical",
                        title: "No Games Yet",
                        message: "Start building your Nintendo Switch library by adding games.",
                        action: { showingAddGame = true },
                        actionLabel: "Add Your First Game"
                    )
                } else {
                    gameList
                }
            }
            .navigationTitle("My Library")
            .searchable(text: $viewModel.searchText, prompt: "Filter games")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingAddGame = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Add game")
                }

                ToolbarItem(placement: .secondaryAction) {
                    Menu {
                        sortMenu
                        Divider()
                        filterMenu
                    } label: {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                    }
                    .accessibilityLabel("Sort and filter options")
                }
            }
            .refreshable {
                await viewModel.loadGames()
            }
            .sheet(isPresented: $showingAddGame) {
                AddGameView { newGame in
                    viewModel.addGame(newGame)
                }
            }
            .sheet(item: $selectedGame) { game in
                EditGameView(game: game) { updatedGame in
                    viewModel.updateGame(updatedGame)
                }
            }
        }
    }

    // MARK: - Game List

    private var gameList: some View {
        List {
            if let errorMessage = viewModel.errorMessage {
                ErrorBanner(message: errorMessage) {
                    viewModel.errorMessage = nil
                }
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets())
            }

            statsSection

            ForEach(viewModel.filteredGames) { game in
                GameRowView(game: game)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        selectedGame = game
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            Task { await viewModel.deleteGame(game) }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                    .swipeActions(edge: .leading) {
                        Button {
                            Task { await viewModel.toggleFavorite(game) }
                        } label: {
                            Label(
                                game.isFavorite == true ? "Unfavorite" : "Favorite",
                                systemImage: game.isFavorite == true ? "heart.slash" : "heart"
                            )
                        }
                        .tint(.pink)
                    }
            }
        }
        .listStyle(.plain)
        .animation(.default, value: viewModel.filteredGames.map(\.id))
    }

    // MARK: - Stats Section

    private var statsSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 16) {
                StatCard(label: "Total", value: viewModel.totalCount, icon: "books.vertical.fill", color: .blue)
                StatCard(label: "Owned", value: viewModel.ownedCount, icon: "gamecontroller.fill", color: .green)
                StatCard(label: "Wishlist", value: viewModel.wishlistCount, icon: "heart.fill", color: .pink)
                StatCard(label: "Favorites", value: viewModel.favoriteCount, icon: "star.fill", color: .yellow)
            }
            .padding(.horizontal)
            .padding(.vertical, 4)
        }
        .listRowSeparator(.hidden)
        .listRowInsets(EdgeInsets())
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Library statistics")
    }

    // MARK: - Sort Menu

    @ViewBuilder
    private var sortMenu: some View {
        Menu("Sort By") {
            ForEach(LibraryViewModel.SortOrder.allCases) { order in
                Button {
                    viewModel.sortOrder = order
                } label: {
                    HStack {
                        Text(order.rawValue)
                        if viewModel.sortOrder == order {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        }
    }

    // MARK: - Filter Menu

    @ViewBuilder
    private var filterMenu: some View {
        Menu("Filter Status") {
            Button("All Statuses") {
                viewModel.selectedStatus = nil
            }
            Divider()
            ForEach(GameStatus.allCases) { status in
                Button {
                    viewModel.selectedStatus = status
                } label: {
                    HStack {
                        Label(status.rawValue, systemImage: status.icon)
                        if viewModel.selectedStatus == status {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        }

        Menu("Filter Platform") {
            Button("All Platforms") {
                viewModel.selectedPlatform = nil
            }
            Divider()
            ForEach(GamePlatform.allCases) { platform in
                Button {
                    viewModel.selectedPlatform = platform
                } label: {
                    HStack {
                        Text(platform.rawValue)
                        if viewModel.selectedPlatform == platform {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Stat Card

struct StatCard: View {
    let label: String
    let value: Int
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)
            Text("\(value)")
                .font(.headline)
                .fontWeight(.bold)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(width: 72)
        .padding(.vertical, 8)
        .background(color.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(value)")
    }
}
