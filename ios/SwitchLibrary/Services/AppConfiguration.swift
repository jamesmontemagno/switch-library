import Foundation

// MARK: - App Configuration

/// Reads static app configuration values bundled in Info.plist.
enum AppConfiguration {
    static var apiBaseURL: String {
        stringValue(for: "API_BASE_URL")
    }

    static var supabaseURL: String {
        stringValue(for: "SUPABASE_URL")
    }

    static var supabaseKey: String {
        stringValue(for: "SUPABASE_KEY")
    }

    private static func stringValue(for key: String) -> String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String else {
            return ""
        }
        return value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
