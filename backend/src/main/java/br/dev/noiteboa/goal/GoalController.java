package br.dev.noiteboa.goal;

import br.dev.noiteboa.goal.dto.GoalRequest;
import br.dev.noiteboa.goal.dto.GoalResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GoalController {

    private final GoalService goalService;

    public GoalController(GoalService goalService) {
        this.goalService = goalService;
    }

    @GetMapping("/api/goal")
    public ResponseEntity<GoalResponse> get(Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        var encontrado = goalService.findOrDefault(email);
        SleepGoal g = encontrado.goal();
        return ResponseEntity.ok(new GoalResponse(
                g.getTargetMinutes(), g.getBedtime(), g.getWakeTime(), encontrado.saved()));
    }

    @PutMapping("/api/goal")
    public ResponseEntity<GoalResponse> put(Authentication authentication, @Valid @RequestBody GoalRequest request) {
        String email = (String) authentication.getPrincipal();
        SleepGoal g = goalService.upsert(email, request);
        // um PUT grava a meta, então a partir daqui ela existe de verdade
        return ResponseEntity.ok(new GoalResponse(g.getTargetMinutes(), g.getBedtime(), g.getWakeTime(), true));
    }
}
