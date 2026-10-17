package br.dev.noiteboa.auth;

import br.dev.noiteboa.auth.dto.RegisterRequest;
import br.dev.noiteboa.auth.dto.RegisterResponse;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final br.dev.noiteboa.auth.jwt.JwtService jwtService;

    /** Hash válido de um valor descartável: roda BCrypt completo quando o e-mail não
     *  existe, para igualar o tempo do login (#103, enumeração de contas). Gerado na
     *  inicialização para nunca ser um valor conhecido. */
    private final String hashFalso;

    public AuthService(UserRepository userRepository, BCryptPasswordEncoder passwordEncoder,
                       br.dev.noiteboa.auth.jwt.JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.hashFalso = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    public RegisterResponse register(RegisterRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.getEmail())) {
            throw new DuplicateEmailException();
        }
        String hash = passwordEncoder.encode(request.getPassword());
        User user = new User(UUID.randomUUID(), request.getEmail(), hash, request.getDisplayName(), OffsetDateTime.now());
        try {
            userRepository.save(user);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // índice único case-insensitive do banco bloqueia corrida de e-mails simultâneos
            throw new DuplicateEmailException();
        }
        return new RegisterResponse(user.getId(), user.getEmail(), user.getDisplayName());
    }

    public br.dev.noiteboa.auth.dto.LoginResponse login(br.dev.noiteboa.auth.dto.LoginRequest request) {
        var user = userRepository.findByEmailIgnoreCase(request.getEmail()).orElse(null);
        // compara sempre — contra o hash da conta ou contra o hash falso — para que
        // e-mail inexistente e senha errada custem o mesmo tempo (#103)
        boolean senhaCorreta = passwordEncoder.matches(request.getPassword(),
            user != null ? user.getPasswordHash() : hashFalso);
        if (user == null || !senhaCorreta) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.UNAUTHORIZED, "Credenciais inválidas");
        }
        String token = jwtService.generateToken(user.getId());
        return new br.dev.noiteboa.auth.dto.LoginResponse(token, jwtService.getExpirationSeconds());
    }
}
