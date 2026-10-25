package com.lifeorganizer.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.NoSuchElementException;
import com.lifeorganizer.media.MediaStorageException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/**
 * Translates exceptions thrown by service-layer code into clean JSON error
 * bodies (rather than the default 500 + stack trace) so the mobile client's
 * {@code data.message} handling has something meaningful to show.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(org.springframework.security.access.AccessDeniedException e) {
        return body(HttpStatus.FORBIDDEN, e.getMessage());
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataConflict(org.springframework.dao.DataIntegrityViolationException e) {
        return body(HttpStatus.CONFLICT, "This change conflicts with the current state. Refresh and try again.");
    }

    @ExceptionHandler(java.time.DateTimeException.class)
    public ResponseEntity<Map<String, Object>> handleTimeZone(java.time.DateTimeException e) {
        return body(HttpStatus.BAD_REQUEST, "Choose a valid IANA time zone");
    }

    @ExceptionHandler(com.lifeorganizer.identity.AbuseLimiter.LimitExceeded.class)
    public ResponseEntity<Map<String, Object>> handleRateLimit(com.lifeorganizer.identity.AbuseLimiter.LimitExceeded e) {
        return body(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Try again later.");
    }

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(org.springframework.http.converter.HttpMessageNotReadableException e) {
        return body(HttpStatus.BAD_REQUEST, "Invalid request data");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBadInput(IllegalArgumentException e) {
        return body(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(MediaStorageException.class)
    public ResponseEntity<Map<String, Object>> handleStorage(MediaStorageException e) {
        return body(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleUploadLimit(MaxUploadSizeExceededException e) {
        return body(HttpStatus.PAYLOAD_TOO_LARGE, "Files must be 25 MB or smaller.");
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NoSuchElementException e) {
        return body(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(IllegalStateException e) {
        return body(HttpStatus.CONFLICT, e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fieldError -> fieldError.getField() + " " + fieldError.getDefaultMessage())
                .orElse("Invalid request");
        return body(HttpStatus.BAD_REQUEST, message);
    }

    private ResponseEntity<Map<String, Object>> body(HttpStatus status, String message) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("timestamp", Instant.now().toString());
        payload.put("status", status.value());
        payload.put("error", status.getReasonPhrase());
        payload.put("message", message);
        return ResponseEntity.status(status).body(payload);
    }
}
