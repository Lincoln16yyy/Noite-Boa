package br.dev.noiteboa.auth.dto;

import jakarta.validation.constraints.Size;

/**
 * Atualização de preferências da conta. Os dois campos são opcionais,
 * mas ao menos um precisa estar presente (validado no controller):
 * timezone é validado com ZoneId; shareWithFriends é o opt-in de
 * compartilhamento das noites registradas com amigos (padrão desligado).
 */
public class UpdateMeRequest {

    /** Identificador IANA, ex.: America/Sao_Paulo (validado com ZoneId no controller). */
    @Size(max = 64)
    private String timezone;

    private Boolean shareWithFriends;

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public Boolean getShareWithFriends() {
        return shareWithFriends;
    }

    public void setShareWithFriends(Boolean shareWithFriends) {
        this.shareWithFriends = shareWithFriends;
    }
}
