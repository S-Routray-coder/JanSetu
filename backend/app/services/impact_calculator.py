from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.grievance import Grievance, GrievanceSupport


class ImpactCalculatorService:
    """
    Computes citizen community impact, affected residents estimates, 
    and civic health index based on grievances and resolutions.
    """

    @staticmethod
    def calculate_citizen_impact(db: Session, citizen_id: int) -> int:
        """
        Calculate total community impact score for a citizen.
        Considers reports submitted, resolved issues, supports received, 
        and severity multiplier.
        """
        grievances = db.query(Grievance).filter(Grievance.citizen_id == citizen_id).all()
        if not grievances:
            return 0

        total_impact = 0
        for g in grievances:
            # Base impact per report
            base = 3
            
            # Severity multiplier
            multiplier = 1
            if g.priority == "Critical":
                multiplier = 3
            elif g.priority == "High":
                multiplier = 2
            
            # Resolution bonus
            resolved_bonus = 5 if g.status == "Resolved" else 0
            
            # Community upvotes / supports
            supports_count = g.community_impact_count or 1

            item_impact = (base * multiplier * supports_count) + resolved_bonus
            total_impact += item_impact

        return total_impact

    @staticmethod
    def calculate_civic_health_index(db: Session, ward: str = None) -> float:
        """
        Calculate a 0-100 score representing civic health (resolution rate, response time).
        """
        query = db.query(Grievance)
        if ward:
            query = query.filter(Grievance.ward == ward)

        total = query.count()
        if total == 0:
            return 100.0

        resolved = query.filter(Grievance.status == "Resolved").count()
        critical_unresolved = query.filter(
            Grievance.status != "Resolved", 
            Grievance.priority == "Critical"
        ).count()

        base_rate = (resolved / total) * 100.0
        penalty = min(30, critical_unresolved * 5)
        
        index = max(10.0, min(100.0, base_rate - penalty + 15))
        return round(index, 1)
