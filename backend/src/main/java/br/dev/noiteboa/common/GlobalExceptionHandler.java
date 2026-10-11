package br.dev.noiteboa.common;

import br.dev.noiteboa.auth.DuplicateEmailException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(DuplicateEmailException.class)
    public ResponseEntity<ProblemDetail> handleDuplicateEmail(DuplicateEmailException ex) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "Já existe uma conta com este e-mail.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(detail);
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ProblemDetail> handleDataIntegrity(
            org.springframework.dao.DataIntegrityViolationException ex) {
        // Corrida de unicidade (issue #106): o duplo clique em "Enviar convite" e dois
        // PUT /goal simultâneos passam pela checagem do serviço antes da gravação do
        // outro, e a segunda gravação viola UNIQUE/PK no banco. É 4xx, não 5xx.
        // A constraint fica no WARN para diagnóstico; a resposta não vaza detalhes.
        log.warn("Violação de integridade (provável corrida de unicidade): {}",
                ex.getMostSpecificCause().getMessage(), ex);
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "Este dado foi salvo ao mesmo tempo por outra requisição. Tente novamente.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(detail);
    }

    @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidation(org.springframework.web.bind.MethodArgumentNotValidException ex) {
        java.util.List<String> errors = ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
            .distinct()
            .toList();
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, String.join("; ", errors));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(detail);
    }

    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<ProblemDetail> handleResponseStatus(org.springframework.web.server.ResponseStatusException ex) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(status,
                ex.getReason() != null ? ex.getReason() : ex.getMessage());
        return ResponseEntity.status(status).body(detail);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleUnexpected(Exception ex, HttpServletRequest request) {
        // A resposta não vaza detalhes, mas a stack fica nos logs para diagnóstico (#84):
        // sem isso, um 500 intermitente é indeterminável a partir do dashboard.
        log.error("Erro não tratado em {} {}", request.getMethod(), request.getRequestURI(), ex);
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "Erro interno");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(detail);
    }
}
