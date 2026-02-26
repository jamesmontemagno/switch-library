import Foundation
import Supabase

// MARK: - Supabase Service

/// Manages authentication and database operations with Supabase.
/// Provides the same dual-mode capability as the web app:
/// games are stored in Supabase when configured, or locally when not.
@MainActor
final class SupabaseService: ObservableObject {
    static let shared = SupabaseService()

    @Published var currentUser: AppUser?
    @Published var isAuthenticated = false
    @Published var isLoading = true

    private var client: SupabaseClient?

    /// Whether Supabase is properly configured.
    var isConfigured: Bool {
        client != nil
    }

    private init() {
        configureClient()
    }

    // MARK: - Configuration

    /// Reads Supabase URL and key from UserDefaults and initializes the client.
    func configureClient() {
        let url = UserDefaults.standard.string(forKey: "supabase_url") ?? ""
        let key = UserDefaults.standard.string(forKey: "supabase_key") ?? ""

        guard !url.isEmpty, !key.isEmpty, let supabaseURL = URL(string: url) else {
            client = nil
            isLoading = false
            return
        }

        client = SupabaseClient(supabaseURL: supabaseURL, supabaseKey: key)
        Task { await checkSession() }
    }

    // MARK: - Authentication

    /// Checks for an existing session on app launch.
    func checkSession() async {
        guard let client else {
            isLoading = false
            return
        }

        do {
            let session = try await client.auth.session
            let user = session.user
            currentUser = AppUser(
                id: user.id.uuidString,
                email: user.email,
                displayName: user.userMetadata["display_name"]?.value as? String
                    ?? user.email
                    ?? "User",
                avatarUrl: user.userMetadata["avatar_url"]?.value as? String
            )
            isAuthenticated = true
        } catch {
            currentUser = nil
            isAuthenticated = false
        }

        isLoading = false
    }

    /// Signs in with email and password.
    func signIn(email: String, password: String) async throws {
        guard let client else { throw SupabaseServiceError.notConfigured }

        let session = try await client.auth.signIn(email: email, password: password)
        let user = session.user
        currentUser = AppUser(
            id: user.id.uuidString,
            email: user.email,
            displayName: user.userMetadata["display_name"]?.value as? String
                ?? user.email
                ?? "User",
            avatarUrl: user.userMetadata["avatar_url"]?.value as? String
        )
        isAuthenticated = true
    }

    /// Signs up with email and password.
    func signUp(email: String, password: String, displayName: String) async throws {
        guard let client else { throw SupabaseServiceError.notConfigured }

        let result = try await client.auth.signUp(
            email: email,
            password: password,
            data: ["display_name": .string(displayName)]
        )
        if let user = result.user {
            currentUser = AppUser(
                id: user.id.uuidString,
                email: user.email,
                displayName: displayName,
                avatarUrl: nil
            )
            isAuthenticated = true
        }
    }

    /// Signs out the current user.
    func signOut() async throws {
        guard let client else { return }
        try await client.auth.signOut()
        currentUser = nil
        isAuthenticated = false
    }

    // MARK: - Games CRUD

    /// Loads all games for the current user.
    func loadGames() async throws -> [GameEntry] {
        guard let client, let userId = currentUser?.id else {
            return loadGamesFromLocal()
        }

        let rows: [SupabaseGameRow] = try await client
            .from("games")
            .select()
            .eq("user_id", value: userId)
            .order("created_at", ascending: false)
            .execute()
            .value

        return rows.map { $0.toGameEntry() }
    }

    /// Saves (upserts) a game entry.
    func saveGame(_ game: GameEntry) async throws -> GameEntry {
        guard let client else {
            saveGameLocally(game)
            return game
        }

        let row = SupabaseGameRow.from(game)
        let savedRows: [SupabaseGameRow] = try await client
            .from("games")
            .upsert(row)
            .select()
            .execute()
            .value

        guard let savedRow = savedRows.first else {
            throw SupabaseServiceError.saveFailed
        }
        return savedRow.toGameEntry()
    }

    /// Deletes a game by its ID.
    func deleteGame(id: String) async throws {
        guard let client else {
            deleteGameLocally(id: id)
            return
        }

        try await client
            .from("games")
            .delete()
            .eq("id", value: id)
            .execute()
    }

    // MARK: - Local Storage Fallback

    private let localStorageKey = "switch_library_games"

    private func loadGamesFromLocal() -> [GameEntry] {
        guard let data = UserDefaults.standard.data(forKey: localStorageKey) else { return [] }
        return (try? JSONDecoder().decode([GameEntry].self, from: data)) ?? []
    }

    private func saveGameLocally(_ game: GameEntry) {
        var games = loadGamesFromLocal()
        if let index = games.firstIndex(where: { $0.id == game.id }) {
            games[index] = game
        } else {
            games.insert(game, at: 0)
        }
        if let data = try? JSONEncoder().encode(games) {
            UserDefaults.standard.set(data, forKey: localStorageKey)
        }
    }

    private func deleteGameLocally(id: String) {
        var games = loadGamesFromLocal()
        games.removeAll { $0.id == id }
        if let data = try? JSONEncoder().encode(games) {
            UserDefaults.standard.set(data, forKey: localStorageKey)
        }
    }
}

// MARK: - Errors

enum SupabaseServiceError: LocalizedError {
    case notConfigured
    case saveFailed

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Supabase is not configured. Please set the URL and Key in Settings."
        case .saveFailed:
            return "Failed to save the game. Please try again."
        }
    }
}
