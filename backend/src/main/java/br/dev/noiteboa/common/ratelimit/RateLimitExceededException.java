package br.dev.noiteboa.common.ratelimit;

/** Estourou o limite de tentativas (issue #104): vira 429 com Retry-After. */
public class RateLimitExceededException extends RuntimeException {

    private final long retryAfterSeconds;

    public RateLimitExceededException(long retryAfterSeconds, String mensagem) {
        super(mensagem);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
