package br.dev.noiteboa.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * Origens permitidas, separadas por vírgula.
     *
     * Lê o nome canônico plural (`cors.allowed-origins`, env `CORS_ALLOWED_ORIGINS`)
     * e, como fallback, o nome legado singular (`cors.allowed-origin`, env
     * `CORS_ALLOWED_ORIGIN`) que a Render e a documentação usavam antes da #105.
     * Sem o fallback, a variável singular era ignorada e a lista caía no default
     * local, bloqueando o front em produção (issue #192).
     */
    @Value("${cors.allowed-origins:${cors.allowed-origin:http://localhost:5173}}")
    private String corsAllowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(org.springframework.security.config.http.SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex.authenticationEntryPoint((req, res, e) -> res.sendError(401)))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/api/auth/register", "/api/auth/login",
                        "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs", "/v3/api-docs/**").permitAll()
                .anyRequest().authenticated()
            )
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .addFilterBefore(jwtAuthenticationFilter, org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /**
     * Configuração de CORS que aceita múltiplas origens separadas por vírgula.
     * Normaliza as origens: trim, remove barra final.
     * Ex.: "https://app.vercel.app, https://app2.vercel.app/" → ["https://app.vercel.app", "https://app2.vercel.app"]
     *
     * Propriedade: cors.allowed-origins (ex.: "https://app.vercel.app,https://app2.vercel.app")
     * Padrão: "http://localhost:5173"
     */
    public org.springframework.web.cors.CorsConfigurationSource corsConfigurationSource() {
        List<String> allowedOrigins = Arrays.stream(corsAllowedOrigins.split(","))
            .map(this::normalizeOrigin)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toList());

        if (allowedOrigins.isEmpty()) {
            allowedOrigins = List.of("http://localhost:5173");
        }

        org.springframework.web.cors.CorsConfiguration config = new org.springframework.web.cors.CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(true);

        org.springframework.web.cors.UrlBasedCorsConfigurationSource source = new org.springframework.web.cors.UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /**
     * Normaliza uma origem: trim, remove barra final, lower case.
     * Ex.: "  https://app.vercel.app/  " → "https://app.vercel.app"
     */
    private String normalizeOrigin(String origin) {
        if (origin == null) return "";
        String normalized = origin.trim().toLowerCase();
        if (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    @org.springframework.beans.factory.annotation.Autowired
    private br.dev.noiteboa.auth.jwt.JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder bCryptPasswordEncoder() {
        return new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
    }
}
