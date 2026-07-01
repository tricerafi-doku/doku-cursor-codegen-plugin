# Kotlin Standards

Extends `coding.md` for Kotlin-specific generated code. Most Kotlin DOKU integrations use Spring Boot with Kotlin DSL or Ktor.

## Language Version
- Kotlin 1.9+ minimum
- Use data classes for DTOs, sealed classes for typed errors
- Coroutines for async (if project uses Ktor or reactive Spring)

## Build Tool
- Detect Gradle Kotlin DSL (`build.gradle.kts`) vs Groovy (`build.gradle`)
- Add DOKU dependencies to existing build file — do not replace the whole file
- Pin dependency versions explicitly

## Configuration / Secrets
- Spring Boot + Kotlin: `application.yml` with `@ConfigurationProperties` data class
  ```kotlin
  @ConfigurationProperties(prefix = "doku")
  data class DokuProperties(val clientId: String, val secretKey: String, val baseUrl: String)
  ```
- Ktor: Environment variables via `System.getenv("DOKU_CLIENT_ID") ?: throw IllegalStateException("DOKU_CLIENT_ID not configured")`
- Never use `!!` on env var reads — throw a descriptive error if missing

## HTTP Client
- **Spring Boot**: Feign Client (same as Java) or WebClient
- **Ktor**: `io.ktor:ktor-client-cio` with `ContentNegotiation` and `kotlinx.serialization`
- Detect from project dependencies

## DTOs / Models
- Use `data class` with `@JsonProperty` (Jackson) or `@SerialName` (kotlinx.serialization)
- Amount fields: `String` or `BigDecimal` — never `Double`/`Float`
- Immutable by default (`val` fields, not `var`)
- `@JsonIgnoreProperties(ignoreUnknown = true)` on response models

## Error Handling
- Sealed class for typed DOKU errors:
  ```kotlin
  sealed class DokuError {
      data class AuthError(val requestId: String, val code: String) : DokuError()
      data class ValidationError(val requestId: String, val code: String, val message: String) : DokuError()
      data class ApiError(val requestId: String, val code: String, val message: String) : DokuError()
      data class NetworkError(val cause: Throwable) : DokuError()
      data class SignatureError(val message: String) : DokuError()
  }
  ```
- Return `Result<T>` or `Either<DokuError, T>` from client methods — don't throw across API boundaries

## Cryptography
- Same as Java: `javax.crypto.Mac`, `java.security.Signature`, `java.util.Base64`
- Kotlin extension functions for readability:
  ```kotlin
  fun String.hmacSha512(key: String): String { ... }
  fun String.sha256Digest(): String { ... }
  ```

## Logging
- Use SLF4J via `org.slf4j.LoggerFactory` or `io.github.oshai:kotlin-logging`
- Idiomatic: `private val log = KotlinLogging.logger {}`
- Structured: `log.info { "DOKU API call | requestId=$requestId endpoint=$path status=$code" }`
- Never log secretKey or full signature value

## Thread Safety / Coroutines
- Token cache with coroutines: use `Mutex` from `kotlinx.coroutines.sync`
  ```kotlin
  private val mutex = Mutex()
  private var cachedToken: TokenInfo? = null

  suspend fun getToken(): String = mutex.withLock {
      if (cachedToken?.isExpired() == false) return@withLock cachedToken!!.value
      refreshToken().also { cachedToken = it }
  }
  ```
- For non-coroutine code: `@Synchronized` or `java.util.concurrent.locks.ReentrantLock`

## Testing
- Framework: **Kotest** (preferred) or JUnit 5
- Mocking: **MockK** (`io.mockk:mockk`)
- HTTP mocking: WireMock or Ktor's `MockEngine` — **never call real DOKU sandbox in unit/integration tests**
- Coroutine tests: `runTest` from `kotlinx-coroutines-test`
- Coverage: **Kover** plugin (`./gradlew koverVerify`) — minimum 80%
- Sandbox tests: Tag with `@Tag("sandbox")` or Kotest tag `object SandboxTag : Tag()`

Required test cases:
```kotlin
test("computes correct HMAC signature") { ... }
test("generates unique requestId per call") { ... }
test("throws DokuAuthError on 401") { ... }
test("throws DokuValidationError on 400") { ... }
// SNAP only:
test("refreshes expired token before request") { runTest { ... } }
test("concurrent requests trigger only one token refresh") { runTest { ... } }
```

## Null Safety
- Avoid `!!` — use `?: throw IllegalArgumentException("field required")`
- Use `?.let { }` for nullable chaining
- Kotlin null safety replaces `@Nullable`/`@NonNull` annotations
