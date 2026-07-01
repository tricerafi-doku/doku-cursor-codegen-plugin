# Java Standards

Extends `coding.md` for Java-specific generated code.

## Language Version
- Java 11+ minimum (most merchant projects)
- Use `var` for local type inference where unambiguous
- Use text blocks (Java 15+) for multi-line JSON templates if project supports it

## Build Tool
- Detect Maven (pom.xml) or Gradle (build.gradle/build.gradle.kts) from merchant project
- Add DOKU SDK dependencies to existing build file
- Pin dependency versions explicitly

## Configuration / Secrets
- **NEVER use `.env` files for Java projects** — `.env` is a Python/Node.js convention
- **Spring Boot**: Use `application.properties` or `application.yml` with profile-based config (`application-dev.properties`, `application-prod.properties`). Access via `@Value("${doku.client-id}")` or `@ConfigurationProperties`
- **Quarkus**: Use `application.properties` with MicroProfile Config and `%dev`/`%prod` profile prefixes. Access via `@ConfigProperty(name = "doku.client-id")`
- **Micronaut**: Use `application.yml` with environment-specific files. Access via `@Value("${doku.client-id}")`
- **Plain Java**: Use system properties (`-Ddoku.clientId=...`) or environment variables via `System.getenv("DOKU_CLIENT_ID")`
- Sensitive properties (Secret Key, Private Key path) must NOT be committed to VCS — use profile-specific config files excluded from version control, or vault integration

## HTTP Client
- **Spring projects**: Use WebClient (reactive) or RestTemplate (servlet)
- **Non-Spring**: Use OkHttp (most common) or Java HttpClient (java.net.http, Java 11+)
- Detect existing HTTP client from project dependencies — prefer what's already used

### private-key-path Must Default to Empty String
When generating `application.yml` for SNAP APIs, `private-key-path` MUST default to an empty string — NOT a file path:

```yaml
# ✅ correct — empty default, skips loading if env var not set
private-key-path: ${DOKU_PRIVATE_KEY_PATH:}

# ❌ WRONG — app crashes on startup if the file doesn't exist
private-key-path: ${DOKU_PRIVATE_KEY_PATH:src/main/resources/private-key.pem}
```

The config `@PostConstruct` / `init` method must check for blank before loading:
```java
if (privateKeyPath != null && !privateKeyPath.isBlank()) {
    this.privateKey = loadPrivateKey(privateKeyPath);
}
```

### Multiple RestTemplate Beans — Always Use @Qualifier
When a project has both Non-SNAP (`dokuRestTemplate`) and SNAP (`dokuSnapRestTemplate`) beans, every constructor injection MUST use `@Qualifier` to avoid `UnsatisfiedDependencyException`:

```java
// ✅ correct
public DokuCheckoutClient(@Qualifier("dokuRestTemplate") RestTemplate restTemplate, ...) { }
public BniVaClient(@Qualifier("dokuSnapRestTemplate") RestTemplate restTemplate, ...) { }

// ❌ WRONG — ambiguous when 2+ RestTemplate beans exist
public DokuCheckoutClient(RestTemplate restTemplate, ...) { }
```

Bean definitions must use matching `@Bean("dokuRestTemplate")` / `@Bean("dokuSnapRestTemplate")` names.

### URL Configuration — base-url + endpoint-path Pattern
Split the DOKU URL into two separate config properties — never combine them in `base-url`:

```yaml
doku:
  base-url: ${DOKU_BASE_URL:https://api-sandbox.doku.com}
  endpoint-path: ${DOKU_ENDPOINT_PATH:/checkout/v1/payment}  # per-API path
```

The config class holds both fields:
```java
@NotBlank private String baseUrl;
@NotBlank private String endpointPath;
```

The client combines them at call time:
```java
var url = config.getBaseUrl() + config.getEndpointPath();
```

The signature interceptor uses `config.getEndpointPath()` as the `Request-Target` — NOT hardcoded, NOT `template.path()`:
```java
"Request-Target:" + config.getEndpointPath()
```

**Why:** Keeps both values independently overridable via env vars. Avoids the bug where `base-url` contains the full path and the call hits only the domain.

---

### RestTemplate Timeout — Spring Boot 3.2+ Breaking Change
`RestTemplateBuilder.connectTimeout(Duration)` was **removed in Spring Boot 3.2**. Do NOT use it.
Configure timeouts via `SimpleClientHttpRequestFactory` directly:

```java
SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
factory.setConnectTimeout(10_000); // 10 seconds
factory.setReadTimeout(30_000);    // 30 seconds
RestTemplate restTemplate = new RestTemplate(factory);
```

Or inject via `RestTemplateBuilder` using the supported API:
```java
RestTemplate restTemplate = builder
    .requestFactory(() -> {
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(10_000);
        f.setReadTimeout(30_000);
        return f;
    })
    .build();
```

## DTOs
- Use Java records (Java 16+) for immutable DTOs if project supports it
- Otherwise use classes with `final` fields, constructor, getters, `equals`/`hashCode`/`toString`
- Use Jackson annotations for JSON serialization: `@JsonProperty`, `@JsonIgnoreProperties(ignoreUnknown = true)`
- Amount fields: Use `BigDecimal`, never `double` or `float`

## Error Handling
- Custom exceptions extending `RuntimeException`:
  - `DokuApiException` (base, includes responseCode + requestId)
  - `DokuAuthException extends DokuApiException`
  - `DokuValidationException extends DokuApiException`
  - `DokuSignatureException extends DokuApiException`
  - `DokuNetworkException extends DokuApiException`
- Never catch generic `Exception` — catch specific types

## Cryptography
- RSA: `java.security.Signature` with `SHA256withRSA`
- HMAC-SHA512: `javax.crypto.Mac` with `HmacSHA512`
- HMAC-SHA256: `javax.crypto.Mac` with `HmacSHA256`
- SHA-256: `java.security.MessageDigest`
- Base64: `java.util.Base64`
- Key loading: `java.security.KeyFactory` with PKCS8 encoded spec

## Logging
- Use SLF4J facade (`org.slf4j.Logger`)
- Structured logging via MDC: `MDC.put("requestId", requestId)`
- Log format: `log.info("DOKU API call completed", kv("endpoint", path), kv("status", code))`

## Testing
- Framework: JUnit 5 (`org.junit.jupiter`)
- Mocking: Mockito for unit tests
- HTTP mocking: WireMock or MockWebServer (OkHttp)
- Assertions: AssertJ preferred, JUnit assertions acceptable
- Sandbox tests: Tag with `@Tag("sandbox")` — excluded from default test run via `@ExcludeTags("sandbox")` in Maven Surefire config
- Test class naming: `{ClassName}Test.java`
- Minimum coverage: 80% (enforce via JaCoCo plugin in pom.xml / build.gradle)
- HTTP mocking: WireMock or MockWebServer — **never call real DOKU sandbox in unit/integration tests**

Required test cases for every generated client:
```java
@Test void request_computesCorrectHmacSignature() { ... }
@Test void request_generatesUniqueRequestIdPerCall() { ... }
@Test void request_timestampIsUtcIso8601() { ... }
@Test void onHttp401_throwsDokuAuthException() { ... }
@Test void onHttp400_throwsDokuValidationException() { ... }
// SNAP only:
@Test void tokenExpired_refreshesBeforeNextRequest() { ... }
@Test void concurrentRequests_triggersOnlyOneTokenRefresh() { ... }
```

## Null Safety
- Use `@Nullable` / `@NonNull` annotations (JSpecify or Jakarta)
- Use `Optional<T>` for return types that may be absent
- Validate non-null parameters with `Objects.requireNonNull()`

## Thread Safety
- Token cache: `ConcurrentHashMap` or `synchronized` block
- HTTP client instances: Reuse (OkHttp and WebClient are thread-safe)
- Immutable DTOs: Thread-safe by construction
