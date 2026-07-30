import SwiftUI

// MARK: - App Entry Point

/// The main entry point for the Switch Library iOS app.
@main
struct SwitchLibraryApp: App {
    @StateObject private var supabase = SupabaseService.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(supabase)
        }
    }
}
