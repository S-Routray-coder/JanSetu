import math
import re
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.grievance import Grievance


class DuplicateFinderService:
    """
    Geo-spatial and textual similarity engine to identify duplicate 
    and clustered civic complaints in the same locality.
    """

    @staticmethod
    def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate the great circle distance in meters between two points on earth.
        """
        R = 6371000  # Radius of Earth in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (math.sin(delta_phi / 2.0) ** 2 +
             math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c

    @staticmethod
    def calculate_text_similarity(text1: str, text2: str) -> float:
        """
        Calculate token-based Jaccard similarity between two texts.
        """
        tokens1 = set(re.findall(r'\w+', text1.lower()))
        tokens2 = set(re.findall(r'\w+', text2.lower()))

        if not tokens1 or not tokens2:
            return 0.0

        intersection = len(tokens1.intersection(tokens2))
        union = len(tokens1.union(tokens2))

        return intersection / float(union)

    @classmethod
    def find_duplicates(
        cls,
        db: Session,
        description: str,
        category: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        radius_meters: float = 1000.0,
        exclude_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Search existing active/recent grievances in DB for duplicates and cluster matches.
        """
        query = db.query(Grievance).filter(Grievance.status != "Resolved")
        if exclude_id:
            query = query.filter(Grievance.id != exclude_id)
        
        grievances = query.all()
        matches = []

        for g in grievances:
            geo_distance = None
            is_geo_close = False

            if latitude is not None and longitude is not None and g.latitude is not None and g.longitude is not None:
                geo_distance = cls.haversine_distance_meters(latitude, longitude, g.latitude, g.longitude)
                if geo_distance <= radius_meters:
                    is_geo_close = True
            
            text_sim = cls.calculate_text_similarity(description, g.description + " " + g.title)
            
            # Category match bonus
            category_match = (category and g.category == category)
            combined_score = text_sim + (0.2 if category_match else 0.0)
            if is_geo_close:
                combined_score += 0.25

            # If strong similarity or moderate similarity in exact same geo vicinity
            if combined_score >= 0.40 or (is_geo_close and text_sim >= 0.20):
                matches.append({
                    "id": g.id,
                    "ticket_id": g.ticket_id,
                    "title": g.title,
                    "category": g.category,
                    "status": g.status,
                    "similarity_score": round(min(1.0, combined_score), 2),
                    "distance_meters": round(geo_distance, 1) if geo_distance is not None else None,
                    "created_at": g.created_at.strftime("%Y-%m-%d %H:%M")
                })

        # Sort by similarity score descending
        matches.sort(key=lambda x: x["similarity_score"], reverse=True)
        is_duplicate_likely = len(matches) > 0 and matches[0]["similarity_score"] >= 0.65
        cluster_size = len(matches)
        
        return {
            "is_duplicate_likely": is_duplicate_likely,
            "potential_matches": matches[:5],  # Top 5
            "cluster_size": cluster_size,
            "estimated_impact_multiplier": max(1, cluster_size + 1)
        }
