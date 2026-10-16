package com.lifeorganizer.memories;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.UUID;

/** Media IDs are issued by the authenticated R2 upload endpoint; arbitrary URLs are not accepted. */
public record MemoryRequest(
        @NotNull UUID photoAssetId,
        @Size(max = 4000) String caption,
        UUID audioAssetId,
        @NotNull LocalDate memoryDate,
        @NotNull UUID groupId) {}
