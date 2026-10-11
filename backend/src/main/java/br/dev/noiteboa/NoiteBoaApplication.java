package br.dev.noiteboa;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.retry.annotation.EnableRetry;

@SpringBootApplication
@EnableRetry
public class NoiteBoaApplication {

    public static void main(String[] args) {
        SpringApplication.run(NoiteBoaApplication.class, args);
    }
}
