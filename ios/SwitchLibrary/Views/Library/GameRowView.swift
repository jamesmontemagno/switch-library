import SwiftUI

// MARK: - Game Row View

/// A single row in the library list showing a game's cover, title, and metadata.
struct GameRowView: View {
    let game: GameEntry

    var body: some View {
        HStack(spacing: 12) {
            GameCoverImage(url: coverURL, width: 60, height: 82)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(game.title)
                        .font(.headline)
                        .lineLimit(2)

                    if game.isFavorite == true {
                        Image(systemName: "heart.fill")
                            .font(.caption)
                            .foregroundStyle(.pink)
                            .accessibilityLabel("Favorite")
                    }
                }

                HStack(spacing: 6) {
                    PlatformBadge(platform: game.platform.shortName)
                    StatusBadge(status: game.status)

                    Text(game.format.rawValue)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                if let notes = game.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            if game.completed == true {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(.green)
                    .accessibilityLabel("Completed")
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
    }

    private var coverURL: URL? {
        guard let urlString = game.coverUrl else { return nil }
        return URL(string: urlString)
    }

    private var accessibilityText: String {
        var parts = [game.title, game.platform.rawValue, game.status.rawValue, game.format.rawValue]
        if game.isFavorite == true { parts.append("Favorite") }
        if game.completed == true { parts.append("Completed") }
        return parts.joined(separator: ", ")
    }
}
