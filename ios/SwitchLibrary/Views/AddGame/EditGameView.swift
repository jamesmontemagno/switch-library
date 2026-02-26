import SwiftUI

// MARK: - Edit Game View

/// Allows editing an existing game entry in the user's library.
struct EditGameView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var supabase = SupabaseService.shared

    let game: GameEntry
    let onSave: (GameEntry) -> Void

    @State private var title: String
    @State private var platform: GamePlatform
    @State private var format: GameFormat
    @State private var status: GameStatus
    @State private var condition: GameCondition
    @State private var notes: String
    @State private var completed: Bool
    @State private var isFavorite: Bool
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(game: GameEntry, onSave: @escaping (GameEntry) -> Void) {
        self.game = game
        self.onSave = onSave
        _title = State(initialValue: game.title)
        _platform = State(initialValue: game.platform)
        _format = State(initialValue: game.format)
        _status = State(initialValue: game.status)
        _condition = State(initialValue: game.condition ?? .good)
        _notes = State(initialValue: game.notes ?? "")
        _completed = State(initialValue: game.completed ?? false)
        _isFavorite = State(initialValue: game.isFavorite ?? false)
    }

    var body: some View {
        NavigationStack {
            Form {
                // Cover art preview
                if let coverUrl = game.coverUrl, let url = URL(string: coverUrl) {
                    Section {
                        HStack {
                            Spacer()
                            GameCoverImage(url: url, width: 100, height: 140)
                            Spacer()
                        }
                    }
                    .listRowBackground(Color.clear)
                }

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

                    Toggle("Completed", isOn: $completed)
                    Toggle("Favorite", isOn: $isFavorite)
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
            .navigationTitle("Edit Game")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await saveGame() }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                    .fontWeight(.semibold)
                }
            }
        }
    }

    private func saveGame() async {
        var updated = game
        updated.title = title.trimmingCharacters(in: .whitespaces)
        updated.platform = platform
        updated.format = format
        updated.status = status
        updated.condition = condition
        updated.notes = notes.isEmpty ? nil : notes
        updated.completed = completed
        updated.isFavorite = isFavorite
        updated.updatedAt = ISO8601DateFormatter().string(from: Date())

        isSaving = true
        do {
            let saved = try await supabase.saveGame(updated)
            onSave(saved)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }
}
