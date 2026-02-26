import SwiftUI

// MARK: - Settings View

/// Configures API connection, Supabase credentials, and manages authentication.
struct SettingsView: View {
    @ObservedObject private var supabase = SupabaseService.shared

    @State private var apiBaseURL: String
    @State private var supabaseURL: String
    @State private var supabaseKey: String
    @State private var showingSignIn = false
    @State private var showingSignUp = false

    // Sign in fields
    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var authError: String?
    @State private var isAuthenticating = false

    init() {
        _apiBaseURL = State(initialValue: UserDefaults.standard.string(forKey: "api_base_url") ?? "")
        _supabaseURL = State(initialValue: UserDefaults.standard.string(forKey: "supabase_url") ?? "")
        _supabaseKey = State(initialValue: UserDefaults.standard.string(forKey: "supabase_key") ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                // Account section
                accountSection

                // API Configuration
                apiSection

                // Supabase Configuration
                supabaseSection

                // About section
                aboutSection
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showingSignIn) {
                signInSheet
            }
            .sheet(isPresented: $showingSignUp) {
                signUpSheet
            }
        }
    }

    // MARK: - Account Section

    private var accountSection: some View {
        Section("Account") {
            if let user = supabase.currentUser {
                HStack(spacing: 12) {
                    if let avatarUrl = user.avatarUrl, let url = URL(string: avatarUrl) {
                        AsyncImage(url: url) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 44, height: 44)
                                .clipShape(Circle())
                        } placeholder: {
                            Circle()
                                .fill(Color(.systemGray4))
                                .frame(width: 44, height: 44)
                                .overlay {
                                    Image(systemName: "person.fill")
                                        .foregroundStyle(.secondary)
                                }
                        }
                    } else {
                        Circle()
                            .fill(Color(.systemGray4))
                            .frame(width: 44, height: 44)
                            .overlay {
                                Image(systemName: "person.fill")
                                    .foregroundStyle(.secondary)
                            }
                    }

                    VStack(alignment: .leading) {
                        Text(user.displayName)
                            .font(.headline)
                        if let email = user.email {
                            Text(email)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .accessibilityElement(children: .combine)

                Button("Sign Out", role: .destructive) {
                    Task {
                        try? await supabase.signOut()
                    }
                }
            } else if supabase.isConfigured {
                Button("Sign In") {
                    showingSignIn = true
                }
                Button("Create Account") {
                    showingSignUp = true
                }
            } else {
                Text("Configure Supabase below to enable authentication")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - API Section

    private var apiSection: some View {
        Section {
            TextField("API Base URL", text: $apiBaseURL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .accessibilityLabel("API Base URL")

            Button("Save API Settings") {
                UserDefaults.standard.set(apiBaseURL, forKey: "api_base_url")
            }
        } header: {
            Text("Game Search API")
        } footer: {
            Text("The Azure Functions API URL for game search and details (e.g., https://your-api.azurewebsites.net/api).")
        }
    }

    // MARK: - Supabase Section

    private var supabaseSection: some View {
        Section {
            TextField("Supabase URL", text: $supabaseURL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .accessibilityLabel("Supabase Project URL")

            SecureField("Supabase Anon Key", text: $supabaseKey)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityLabel("Supabase anonymous key")

            Button("Save & Connect") {
                UserDefaults.standard.set(supabaseURL, forKey: "supabase_url")
                UserDefaults.standard.set(supabaseKey, forKey: "supabase_key")
                supabase.configureClient()
            }
        } header: {
            Text("Supabase (Library Storage)")
        } footer: {
            Text("Connect to Supabase for cloud-synced game library and authentication. Without this, games are stored locally on device.")
        }
    }

    // MARK: - About Section

    private var aboutSection: some View {
        Section("About") {
            LabeledContent("App", value: "Switch Library")
            LabeledContent("Version", value: "1.0.0")
            LabeledContent("Platform", value: "iOS")
        }
    }

    // MARK: - Sign In Sheet

    private var signInSheet: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                        .accessibilityLabel("Email address")

                    SecureField("Password", text: $password)
                        .accessibilityLabel("Password")
                }

                if let authError {
                    Section {
                        Text(authError)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button {
                        Task { await signIn() }
                    } label: {
                        HStack {
                            Spacer()
                            if isAuthenticating {
                                ProgressView()
                            } else {
                                Text("Sign In")
                                    .fontWeight(.semibold)
                            }
                            Spacer()
                        }
                    }
                    .disabled(email.isEmpty || password.isEmpty || isAuthenticating)
                }
            }
            .navigationTitle("Sign In")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingSignIn = false }
                }
            }
        }
    }

    // MARK: - Sign Up Sheet

    private var signUpSheet: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Display Name", text: $displayName)
                        .textInputAutocapitalization(.words)
                        .accessibilityLabel("Display name")

                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                        .accessibilityLabel("Email address")

                    SecureField("Password", text: $password)
                        .accessibilityLabel("Password")
                }

                if let authError {
                    Section {
                        Text(authError)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button {
                        Task { await signUp() }
                    } label: {
                        HStack {
                            Spacer()
                            if isAuthenticating {
                                ProgressView()
                            } else {
                                Text("Create Account")
                                    .fontWeight(.semibold)
                            }
                            Spacer()
                        }
                    }
                    .disabled(displayName.isEmpty || email.isEmpty || password.isEmpty || isAuthenticating)
                }
            }
            .navigationTitle("Create Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingSignUp = false }
                }
            }
        }
    }

    // MARK: - Auth Actions

    private func signIn() async {
        isAuthenticating = true
        authError = nil
        do {
            try await supabase.signIn(email: email, password: password)
            showingSignIn = false
        } catch {
            authError = error.localizedDescription
        }
        isAuthenticating = false
    }

    private func signUp() async {
        isAuthenticating = true
        authError = nil
        do {
            try await supabase.signUp(email: email, password: password, displayName: displayName)
            showingSignUp = false
        } catch {
            authError = error.localizedDescription
        }
        isAuthenticating = false
    }
}
