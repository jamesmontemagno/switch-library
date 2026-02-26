import SwiftUI

// MARK: - Game Cover Image

/// Displays a game's cover art with a placeholder when unavailable.
struct GameCoverImage: View {
    let url: URL?
    let width: CGFloat
    let height: CGFloat

    init(url: URL?, width: CGFloat = 80, height: CGFloat = 110) {
        self.url = url
        self.width = width
        self.height = height
    }

    var body: some View {
        if let url {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: width, height: height)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                case .failure:
                    placeholderView
                case .empty:
                    ProgressView()
                        .frame(width: width, height: height)
                @unknown default:
                    placeholderView
                }
            }
        } else {
            placeholderView
        }
    }

    private var placeholderView: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color(.systemGray5))
            .frame(width: width, height: height)
            .overlay {
                Image(systemName: "gamecontroller")
                    .font(.title2)
                    .foregroundStyle(.secondary)
            }
    }
}

// MARK: - Platform Badge

/// A small colored badge showing the platform name.
struct PlatformBadge: View {
    let platform: String

    var body: some View {
        Text(platform)
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(platformColor.opacity(0.15))
            .foregroundStyle(platformColor)
            .clipShape(Capsule())
    }

    private var platformColor: Color {
        if platform.contains("2") {
            return .blue
        }
        return .red
    }
}

// MARK: - Status Badge

/// A small badge showing the game's status.
struct StatusBadge: View {
    let status: GameStatus

    var body: some View {
        Label(status.rawValue, systemImage: status.icon)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(statusColor.opacity(0.15))
            .foregroundStyle(statusColor)
            .clipShape(Capsule())
    }

    private var statusColor: Color {
        switch status {
        case .owned: return .green
        case .wishlist: return .pink
        case .borrowed: return .orange
        case .lent: return .purple
        case .sold: return .gray
        }
    }
}

// MARK: - Empty State View

/// Shown when a list has no content.
struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var action: (() -> Void)?
    var actionLabel: String?

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: icon)
        } description: {
            Text(message)
        } actions: {
            if let action, let actionLabel {
                Button(actionLabel, action: action)
                    .buttonStyle(.borderedProminent)
            }
        }
    }
}

// MARK: - Error Banner

/// A dismissible error message banner.
struct ErrorBanner: View {
    let message: String
    var onDismiss: (() -> Void)?

    var body: some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.yellow)
            Text(message)
                .font(.subheadline)
            Spacer()
            if let onDismiss {
                Button {
                    onDismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .accessibilityLabel("Dismiss error")
            }
        }
        .padding()
        .background(.red.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(.horizontal)
    }
}
