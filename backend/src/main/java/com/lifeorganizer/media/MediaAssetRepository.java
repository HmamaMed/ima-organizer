package com.lifeorganizer.media;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface MediaAssetRepository extends JpaRepository<MediaAsset, UUID> {
    List<MediaAsset> findByGroupId(UUID groupId);
    boolean existsByObjectKey(String objectKey);
    void deleteByGroupId(UUID groupId);
}
