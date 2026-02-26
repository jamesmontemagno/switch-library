import Foundation

// MARK: - Platform & Enums

enum GamePlatform: String, Codable, CaseIterable, Identifiable {
    case nintendoSwitch = "Nintendo Switch"
    case nintendoSwitch2 = "Nintendo Switch 2"

    var id: String { rawValue }

    var platformId: Int {
        switch self {
        case .nintendoSwitch: return 4971
        case .nintendoSwitch2: return 5021
        }
    }

    var shortName: String {
        switch self {
        case .nintendoSwitch: return "Switch"
        case .nintendoSwitch2: return "Switch 2"
        }
    }

    /// Returns the matching platform for a given API platform ID.
    static func from(platformId: Int, fallback: GamePlatform = .nintendoSwitch) -> GamePlatform {
        switch platformId {
        case GamePlatform.nintendoSwitch2.platformId: return .nintendoSwitch2
        case GamePlatform.nintendoSwitch.platformId: return .nintendoSwitch
        default: return fallback
        }
    }
}

enum GameFormat: String, Codable, CaseIterable, Identifiable {
    case physical = "Physical"
    case digital = "Digital"

    var id: String { rawValue }
}

enum GameStatus: String, Codable, CaseIterable, Identifiable {
    case owned = "Owned"
    case wishlist = "Wishlist"
    case borrowed = "Borrowed"
    case lent = "Lent"
    case sold = "Sold"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .owned: return "gamecontroller.fill"
        case .wishlist: return "heart.fill"
        case .borrowed: return "arrow.down.circle.fill"
        case .lent: return "arrow.up.circle.fill"
        case .sold: return "tag.fill"
        }
    }
}

enum GameCondition: String, Codable, CaseIterable, Identifiable {
    case new = "New"
    case likeNew = "Like New"
    case good = "Good"
    case fair = "Fair"
    case poor = "Poor"

    var id: String { rawValue }
}

// MARK: - Game Entry (User's Library)

/// Represents a game in the user's personal library, stored in Supabase.
struct GameEntry: Identifiable, Codable, Equatable {
    let id: String
    let userId: String
    var title: String
    var platform: GamePlatform
    var format: GameFormat
    var status: GameStatus
    var condition: GameCondition?
    var notes: String?
    var thegamesdbId: Int?
    var coverUrl: String?
    var purchaseDate: String?
    var completed: Bool?
    var completedDate: String?
    var isFavorite: Bool?
    let createdAt: String
    var updatedAt: String

    /// Creates a new GameEntry with default values.
    static func create(
        userId: String,
        title: String,
        platform: GamePlatform = .nintendoSwitch,
        format: GameFormat = .physical,
        status: GameStatus = .owned,
        thegamesdbId: Int? = nil,
        coverUrl: String? = nil
    ) -> GameEntry {
        let now = ISO8601DateFormatter().string(from: Date())
        return GameEntry(
            id: UUID().uuidString,
            userId: userId,
            title: title,
            platform: platform,
            format: format,
            status: status,
            condition: nil,
            notes: nil,
            thegamesdbId: thegamesdbId,
            coverUrl: coverUrl,
            purchaseDate: nil,
            completed: false,
            completedDate: nil,
            isFavorite: false,
            createdAt: now,
            updatedAt: now
        )
    }
}

// MARK: - Supabase Row Mapping

/// Maps between camelCase Swift properties and snake_case Supabase columns.
struct SupabaseGameRow: Codable {
    let id: String
    let user_id: String
    var title: String
    var platform: String
    var format: String
    var status: String
    var condition: String?
    var notes: String?
    var thegamesdb_id: Int?
    var cover_url: String?
    var purchase_date: String?
    var completed: Bool?
    var completed_date: String?
    var favorite: Bool?
    let created_at: String
    var updated_at: String

    func toGameEntry() -> GameEntry {
        GameEntry(
            id: id,
            userId: user_id,
            title: title,
            platform: GamePlatform(rawValue: platform) ?? .nintendoSwitch,
            format: GameFormat(rawValue: format) ?? .physical,
            status: GameStatus(rawValue: status) ?? .owned,
            condition: condition.flatMap { GameCondition(rawValue: $0) },
            notes: notes,
            thegamesdbId: thegamesdb_id,
            coverUrl: cover_url,
            purchaseDate: purchase_date,
            completed: completed,
            completedDate: completed_date,
            isFavorite: favorite,
            createdAt: created_at,
            updatedAt: updated_at
        )
    }

    static func from(_ entry: GameEntry) -> SupabaseGameRow {
        SupabaseGameRow(
            id: entry.id,
            user_id: entry.userId,
            title: entry.title,
            platform: entry.platform.rawValue,
            format: entry.format.rawValue,
            status: entry.status.rawValue,
            condition: entry.condition?.rawValue,
            notes: entry.notes,
            thegamesdb_id: entry.thegamesdbId,
            cover_url: entry.coverUrl,
            purchase_date: entry.purchaseDate,
            completed: entry.completed,
            completed_date: entry.completedDate,
            favorite: entry.isFavorite,
            created_at: entry.createdAt,
            updated_at: entry.updatedAt
        )
    }
}
