from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.schemas import AnnotationRequest, TrainRequest
from app.models.models import UncertainPrediction, ModelVersion
from app.rasa_client import rasa_client
from datetime import datetime
import subprocess
import os

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/intents")
async def list_intents():
    """List all intents from Rasa domain."""
    try:
        tracker = await rasa_client.get_tracker("test")
        # Return domain intents
        return {"status": "success"}
    except Exception:
        # Fallback: read from domain.yml
        import yaml
        domain_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "domain.yml")
        if os.path.exists(domain_path):
            with open(domain_path) as f:
                domain = yaml.safe_load(f)
            return {"intents": domain.get("intents", [])}
        return {"intents": []}


@router.get("/uncertain-predictions")
async def get_uncertain_predictions(
    limit: int = 50, db: Session = Depends(get_db)
):
    """Get predictions that need human annotation."""
    predictions = (
        db.query(UncertainPrediction)
        .filter(UncertainPrediction.is_annotated == False)
        .order_by(UncertainPrediction.confidence)
        .limit(limit)
        .all()
    )

    return [
        {
            "id": p.id,
            "text": p.text,
            "predicted_intent": p.predicted_intent,
            "confidence": p.confidence,
        }
        for p in predictions
    ]


@router.post("/annotate")
async def annotate_prediction(request: AnnotationRequest, db: Session = Depends(get_db)):
    """Annotate an uncertain prediction with the correct intent."""
    # Find the most recent matching uncertain prediction
    prediction = (
        db.query(UncertainPrediction)
        .filter(
            UncertainPrediction.text == request.text,
            UncertainPrediction.is_annotated == False,
        )
        .first()
    )

    if prediction:
        prediction.is_annotated = True
        prediction.correct_intent = request.correct_intent
        db.commit()

    return {"status": "annotated", "text": request.text, "intent": request.correct_intent}


@router.post("/train")
async def train_model(request: TrainRequest = TrainRequest()):
    """Trigger Rasa model retraining."""
    try:
        project_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        result = subprocess.run(
            ["rasa", "train"],
            capture_output=True,
            text=True,
            cwd=project_dir,
            timeout=300,
        )

        if result.returncode == 0:
            # Create model version record
            return {
                "status": "success",
                "message": "Model trained successfully",
                "output": result.stdout[-500:] if result.stdout else "",
            }
        else:
            return {
                "status": "error",
                "message": "Training failed",
                "error": result.stderr[-500:] if result.stderr else "",
            }
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Training timed out after 5 minutes"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/model/versions")
async def get_model_versions(db: Session = Depends(get_db)):
    """Get model version history."""
    versions = db.query(ModelVersion).order_by(ModelVersion.created_at.desc()).all()
    return [
        {
            "id": v.id,
            "version": v.version,
            "intent_f1": v.intent_f1,
            "entity_f1": v.entity_f1,
            "status": v.status,
            "created_at": v.created_at.isoformat(),
        }
        for v in versions
    ]


@router.get("/model/evaluate")
async def evaluate_model():
    """Run Rasa NLU evaluation."""
    try:
        project_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        result = subprocess.run(
            ["rasa", "test", "nlu", "--out", "results/"],
            capture_output=True,
            text=True,
            cwd=project_dir,
            timeout=120,
        )

        return {
            "status": "completed",
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
