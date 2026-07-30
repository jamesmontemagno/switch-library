import SwiftUI

// MARK: - Settings View

/// Configures API connection, Supabase credentials, and manages authentication.
struct SettingsView: View {
    @ObservedObject private var supabase = SupabaseService.shared

    @State private var showingSignIn = false
    @State private var showingSignUp = false

    // Sign in fields
    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var authError: String?
    @State private var isAuthenticating = false

    var body: some View {
        NavigationStack {
            Form {
                // Account section
                accountSection

                // Connection status
                connectionSection

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
                Text("Supabase authentication is unavailable in this build.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Connection Section

    private var connectionSection: some View {
        Section {
            LabeledContent("Game Search API") {
                Text(AppConfiguration.apiBaseURL.isEmpty ? "Not configured" : "Configured")
                    .foregroundStyle(AppConfiguration.apiBaseURL.isEmpty ? .secondary : .primary)
            }

            LabeledContent("Supabase") {
                Text(supabase.isConfigured ? "Configured" : "Not configured")
                    .foregroundStyle(supabase.isConfigured ? .primary : .secondary)
            }
        } header: {
            Text("Connections")
        } footer: {
            Text("Connection values are bundled at build time and are not editable in-app.")
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
