import SwiftUI

// MARK: - Add Game View

/// Allows users to add a game to their library, either from a search result
/// or by entering details manually.
struct AddGameView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var supabase = SupabaseService.shared
    @StateObject private var searchViewModel = SearchViewModel()

    @State private var mode: AddMode = .search
    @State private var selectedAPIGame: APIGame?
    @State private var showingManualEntry = false

    // Manual entry fields
    @State private var title = ""
    @State private var platform: GamePlatform = .nintendoSwitch
    @State private var format: GameFormat = .physical
    @State private var status: GameStatus = .owned
    @State private var condition: GameCondition = .good
    @State private var notes = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    let onAdd: (GameEntry) -> Void

    enum AddMode: String, CaseIterable {
        case search = "Search"
        case manual = "Manual"
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Mode picker
                Picker("Add Mode", selection: $mode) {
                    ForEach(AddMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .padding()

                switch mode {
                case .search:
                    searchContent
                case .manual:
                    manualEntryForm
                }
            }
            .navigationTitle("Add Game")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .sheet(item: $selectedAPIGame) { game in
                addFromSearchSheet(game: game)
            }
        }
    }

    // MARK: - Search Content

    private var searchContent: some View {
        Group {
            if searchViewModel.results.isEmpty && !searchViewModel.isSearching && searchViewModel.searchText.isEmpty {
                EmptyStateView(
                    icon: "magnifyingglass",
                    title: "Find a Game",
                    message: "Search the database to quickly add a game with cover art and details."
                )
            } else if searchViewModel.results.isEmpty && !searchViewModel.isSearching {
                EmptyStateView(
                    icon: "magnifyingglass",
                    title: "No Results",
                    message: "Try a different search term."
                )
            } else {
                List {
                    ForEach(searchViewModel.results) { game in
                        Button {
                            selectedAPIGame = game
                        } label: {
                            SearchResultRow(game: game)
                        }
                        .buttonStyle(.plain)
                    }

                    if searchViewModel.isSearching {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .searchable(text: $searchViewModel.searchText, prompt: "Search games to add…")
        .onSubmit(of: .search) {
            Task { await searchViewModel.search() }
        }
    }

    // MARK: - Add from Search Sheet

    private func addFromSearchSheet(game: APIGame) -> some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 12) {
                        GameCoverImage(url: game.coverImageURL, width: 60, height: 82)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(game.gameTitle)
                                .font(.headline)
                            PlatformBadge(platform: game.platformDisplayName)
                            if let date = game.formattedReleaseDate {
                                Text(date)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                Section("Details") {
                    Picker("Platform", selection: $platform) {
                        ForEach(GamePlatform.allCases) { p in
                            Text(p.rawValue).tag(p)
                        }
                    }
                    Picker("Format", selection: $format) {
                        ForEach(GameFormat.allCases) { f in
                            Text(f.rawValue).tag(f)
                        }
                    }
                    Picker("Status", selection: $status) {
                        ForEach(GameStatus.allCases) { s in
                            Label(s.rawValue, systemImage: s.icon).tag(s)
                        }
                    }
                    Picker("Condition", selection: $condition) {
                        ForEach(GameCondition.allCases) { c in
                            Text(c.rawValue).tag(c)
                        }
                    }
                }

                Section("Notes") {
                    TextField("Optional notes", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Add to Library")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { selectedAPIGame = nil }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        Task { await addGameFromSearch(game) }
                    }
                    .disabled(isSaving)
                    .fontWeight(.semibold)
                }
            }
        }
    }

    // MARK: - Manual Entry Form

    private var manualEntryForm: some View {
        Form {
            Section("Game Info") {
                TextField("Title", text: $title)
                    .textInputAutocapitalization(.words)

                Picker("Platform", selection: $platform) {
                    ForEach(GamePlatform.allCases) { p in
                        Text(p.rawValue).tag(p)
                    }
                }
                Picker("Format", selection: $format) {
                    ForEach(GameFormat.allCases) { f in
                        Text(f.rawValue).tag(f)
                    }
                }
            }

            Section("Status") {
                Picker("Status", selection: $status) {
                    ForEach(GameStatus.allCases) { s in
                        Label(s.rawValue, systemImage: s.icon).tag(s)
                    }
                }
                Picker("Condition", selection: $condition) {
                    ForEach(GameCondition.allCases) { c in
                        Text(c.rawValue).tag(c)
                    }
                }
            }

            Section("Notes") {
                TextField("Optional notes", text: $notes, axis: .vertical)
                    .lineLimit(3...6)
            }

            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                }
            }

            Section {
                Button {
                    Task { await addManualGame() }
                } label: {
                    HStack {
                        Spacer()
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Add Game")
                                .fontWeight(.semibold)
                        }
                        Spacer()
                    }
                }
                .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
            }
        }
    }

    // MARK: - Actions

    private func addGameFromSearch(_ apiGame: APIGame) async {
        let userId = supabase.currentUser?.id ?? "local"
        let coverUrl = apiGame.coverImageURL?.absoluteString

        // Determine platform from API game
        let gamePlatform = GamePlatform.from(platformId: apiGame.platform, fallback: platform)

        var game = GameEntry.create(
            userId: userId,
            title: apiGame.gameTitle,
            platform: gamePlatform,
            format: format,
            status: status,
            thegamesdbId: apiGame.id,
            coverUrl: coverUrl
        )
        game.condition = condition
        game.notes = notes.isEmpty ? nil : notes

        isSaving = true
        do {
            let saved = try await supabase.saveGame(game)
            onAdd(saved)
            selectedAPIGame = nil
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }

    private func addManualGame() async {
        let userId = supabase.currentUser?.id ?? "local"
        var game = GameEntry.create(
            userId: userId,
            title: title.trimmingCharacters(in: .whitespaces),
            platform: platform,
            format: format,
            status: status
        )
        game.condition = condition
        game.notes = notes.isEmpty ? nil : notes

        isSaving = true
        do {
            let saved = try await supabase.saveGame(game)
            onAdd(saved)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }
}
