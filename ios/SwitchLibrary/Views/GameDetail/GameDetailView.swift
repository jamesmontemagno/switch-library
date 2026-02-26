import SwiftUI

// MARK: - Game Detail View

/// Shows comprehensive details for a game from the database,
/// including overview, metadata, boxart, and recommendations.
struct GameDetailView: View {
    @StateObject private var viewModel: GameDetailViewModel
    let onAddGame: ((APIGame) -> Void)?

    init(gameId: Int, game: APIGame? = nil, onAddGame: ((APIGame) -> Void)? = nil) {
        _viewModel = StateObject(wrappedValue: GameDetailViewModel(gameId: gameId, game: game))
        self.onAddGame = onAddGame
    }

    var body: some View {
        ScrollView {
            if viewModel.isLoading {
                ProgressView("Loading game details…")
                    .frame(maxWidth: .infinity, minHeight: 300)
            } else if let game = viewModel.game {
                gameContent(game)
            } else if let error = viewModel.errorMessage {
                EmptyStateView(
                    icon: "exclamationmark.triangle",
                    title: "Error",
                    message: error
                )
            }
        }
        .navigationTitle(viewModel.game?.gameTitle ?? "Game Details")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let game = viewModel.game, onAddGame != nil {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        onAddGame?(game)
                    } label: {
                        Label("Add to Library", systemImage: "plus.circle.fill")
                    }
                    .accessibilityLabel("Add \(game.gameTitle) to library")
                }
            }
        }
        .task {
            await viewModel.loadGame()
        }
    }

    // MARK: - Game Content

    @ViewBuilder
    private func gameContent(_ game: APIGame) -> some View {
        VStack(spacing: 0) {
            // Header with cover art
            headerSection(game)

            VStack(alignment: .leading, spacing: 20) {
                // Metadata grid
                metadataSection(game)

                // Overview
                if let overview = game.overview, !overview.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Overview")
                            .font(.headline)
                        Text(overview)
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }
                }

                // Genres
                if let genres = game.genres, !genres.isEmpty {
                    tagSection(title: "Genres", items: genres)
                }

                // Developers
                if let developers = game.developers, !developers.isEmpty {
                    tagSection(title: "Developers", items: developers)
                }

                // Publishers
                if let publishers = game.publishers, !publishers.isEmpty {
                    tagSection(title: "Publishers", items: publishers)
                }

                // Recommendations
                if !viewModel.recommendations.isEmpty {
                    recommendationsSection
                }
            }
            .padding()
        }
    }

    // MARK: - Header Section

    @ViewBuilder
    private func headerSection(_ game: APIGame) -> some View {
        ZStack(alignment: .bottom) {
            // Background blur
            if let url = game.coverImageURL {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(height: 200)
                        .clipped()
                        .overlay(.ultraThinMaterial)
                } placeholder: {
                    Rectangle()
                        .fill(Color(.systemGray5))
                        .frame(height: 200)
                }
            } else {
                Rectangle()
                    .fill(Color(.systemGray5))
                    .frame(height: 200)
            }

            HStack(alignment: .bottom, spacing: 16) {
                GameCoverImage(url: game.coverImageURL, width: 100, height: 140)
                    .shadow(radius: 8)

                VStack(alignment: .leading, spacing: 6) {
                    Text(game.gameTitle)
                        .font(.title2)
                        .fontWeight(.bold)
                        .lineLimit(3)

                    PlatformBadge(platform: game.platformDisplayName)

                    if let releaseDate = game.formattedReleaseDate {
                        Label(releaseDate, systemImage: "calendar")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding()
            .background(.ultraThinMaterial)
        }
    }

    // MARK: - Metadata Section

    @ViewBuilder
    private func metadataSection(_ game: APIGame) -> some View {
        let gridItems = [GridItem(.flexible()), GridItem(.flexible())]

        LazyVGrid(columns: gridItems, spacing: 12) {
            if let players = game.players, players > 0 {
                MetadataCard(icon: "person.2.fill", label: "Players", value: "\(players)")
            }

            if let rating = game.rating, !rating.isEmpty {
                MetadataCard(icon: "star.fill", label: "Rating", value: rating)
            }

            if let coop = game.coop {
                let coopLower = coop.lowercased()
                MetadataCard(
                    icon: "person.2.wave.2.fill",
                    label: "Co-op",
                    value: coopLower == "yes" || coopLower == "true" ? "Yes" : "No"
                )
            }

            if let regionId = game.regionId {
                MetadataCard(icon: "globe", label: "Region", value: GameRegion.name(for: regionId))
            }
        }
    }

    // MARK: - Tag Section

    @ViewBuilder
    private func tagSection(title: String, items: [APILookupItem]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)

            FlowLayout(spacing: 8) {
                ForEach(items) { item in
                    Text(item.name)
                        .font(.subheadline)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color(.systemGray5))
                        .clipShape(Capsule())
                }
            }
        }
    }

    // MARK: - Recommendations Section

    private var recommendationsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Similar Games")
                .font(.headline)

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 12) {
                    ForEach(viewModel.recommendations) { rec in
                        NavigationLink {
                            GameDetailView(gameId: rec.id, game: rec, onAddGame: onAddGame)
                        } label: {
                            VStack(spacing: 6) {
                                GameCoverImage(url: rec.coverImageURL, width: 80, height: 110)
                                Text(rec.gameTitle)
                                    .font(.caption)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.center)
                                    .frame(width: 80)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

// MARK: - Metadata Card

struct MetadataCard: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(.blue)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
            Spacer()
        }
        .padding(10)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(value)")
    }
}

// MARK: - Flow Layout

/// A horizontal wrapping layout for tags and badges.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y),
                proposal: .unspecified
            )
        }
    }

    private struct ArrangementResult {
        var positions: [CGPoint]
        var size: CGSize
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> ArrangementResult {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        var totalWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)

            if currentX + size.width > maxWidth, currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }

            positions.append(CGPoint(x: currentX, y: currentY))
            lineHeight = max(lineHeight, size.height)
            currentX += size.width + spacing
            totalWidth = max(totalWidth, currentX - spacing)
            totalHeight = currentY + lineHeight
        }

        return ArrangementResult(positions: positions, size: CGSize(width: totalWidth, height: totalHeight))
    }
}
