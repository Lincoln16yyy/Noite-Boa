package br.dev.noiteboa.auth.jwt;

import br.dev.noiteboa.auth.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.UUID;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                UUID userId = jwtService.parseUserId(token);
                if (userId != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                    // O subject é o id da conta (#276): se essa conta não existe mais
                    // — apagada, ou token de quando o subject era o e-mail — a
                    // requisição segue sem autenticação. É o que impede um token de
                    // conta excluída de valer para quem se cadastrar com o mesmo
                    // e-mail depois. O principal continua sendo o e-mail, que é o que
                    // os controllers consultam.
                    userRepository.findById(userId).ifPresent(user -> {
                        UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(user.getEmail(), null, Collections.emptyList());
                        auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    });
                }
            } catch (Exception ignored) {
                // token inválido/expirado: segue a cadeia sem autenticação (rotas protegidas retornam 401)
            }
        }
        filterChain.doFilter(request, response);
    }
}
