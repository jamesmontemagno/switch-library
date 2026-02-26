import SwiftUI

// MARK: - Search Result Row

/// A single row in the search results showing game info from the API.
struct SearchResultRow: View {
    let game: APIGame

    var body: some View {
        HStack(spacing: 12) {
            GameCoverImage(url: game.coverImageURL, width: 60, height: 82)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                Text(game.gameTitle)
                    .font(.headline)
                    .lineLimit(2)

                HStack(spacing: 6) {
                    PlatformBadge(platform: game.platformDisplayName)

                    if let releaseDate = game.formattedReleaseDate {
                        Text(releaseDate)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                if let genres = game.genres, !genres.isEmpty {
                    Text(genres.prefix(3).map(\.name).joined(separator: ", "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                if let players = game.players, players > 0 {
                    Label("\(players) player\(players > 1 ? "s" : "")", systemImage: "person.2")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
    }

    private var accessibilityText: String {
        var parts = [game.gameTitle, game.platformDisplayName]
        if let releaseDate = game.formattedReleaseDate {
            parts.append("Released \(releaseDate)")
        }
        return parts.joined(separator: ", ")
    }
}
