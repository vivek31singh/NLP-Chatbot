from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.schemas import AnnotationRequest, TrainRequest
from app.models.models import UncertainPrediction, ModelVersion
from app.rasa_client import rasa_client
from datetime import datetime
import subprocess
import os
import yaml
import re
import glob

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
NLU_PATH = os.path.join(PROJECT_DIR, "data", "nlu.yml")


@router.get("/intents")
async def list_intents():
    try:
        with open(os.path.join(PROJECT_DIR, "domain.yml")) as f:
            domain = yaml.safe_load(f)
        intents = domain.get("intents", [])
        return {"intents": intents}
    except Exception as e:
        return {"intents": [], "error": str(e)}


@router.get("/intents/phrases")
async def list_intents_with_phrases():
    try:
        with open(NLU_PATH, "r") as f:
            nlu_data = yaml.safe_load(f)

        if not nlu_data or "nlu" not in nlu_data:
            return []

        result = []
        for item in nlu_data["nlu"]:
            intent = item.get("intent")
            examples = item.get("examples", "")
            if intent:
                phrases = [
                    line.strip().lstrip("- ")
                    for line in examples.strip().split("\n")
                    if line.strip()
                ]
                result.append({"intent": intent, "phrases": phrases})

        return result
    except Exception as e:
        return []


@router.post("/intents/{intent}/phrases")
async def add_training_phrase(intent: str, request: dict, db: Session = Depends(get_db)):
    phrase = request.get("phrase", "").strip()
    if not phrase:
        raise HTTPException(status_code=400, detail="Phrase is required")

    written = _write_annotation_to_nlu(phrase, intent)

    if written:
        try:
            from app.models.models import TrainingPhrase
            tp = TrainingPhrase(intent=intent, phrase=phrase, source="admin")
            db.add(tp)
            db.commit()
        except Exception:
            pass

    return {"status": "ok", "written_to_nlu": written}


@router.get("/uncertain-predictions")
async def get_uncertain_predictions(
    limit: int = 50, db: Session = Depends(get_db)
):
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


def _write_annotation_to_nlu(text: str, intent: str):
    if not os.path.exists(NLU_PATH):
        return False

    with open(NLU_PATH, "r") as f:
        content = f.read()

    intent_pattern = re.compile(
        rf"(- intent: {re.escape(intent)}\s+examples: \|)",
        re.MULTILINE,
    )

    match = intent_pattern.search(content)
    if not match:
        return False

    intent_block_start = match.start()

    next_intent_pattern = re.compile(r"\n- intent: ", re.MULTILINE)
    next_match = next_intent_pattern.search(content, match.end())

    if next_match:
        insert_pos = next_match.start()
    else:
        insert_pos = len(content)

    new_line = f"    - {text}\n"
    new_content = content[:insert_pos] + new_line + content[insert_pos:]

    with open(NLU_PATH, "w") as f:
        f.write(new_content)

    return True


@router.post("/annotate")
async def annotate_prediction(request: AnnotationRequest, db: Session = Depends(get_db)):
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

    written = _write_annotation_to_nlu(request.text, request.correct_intent)

    return {
        "status": "annotated",
        "text": request.text,
        "intent": request.correct_intent,
        "written_to_nlu": written,
    }


@router.post("/train")
async def train_model(request: TrainRequest = TrainRequest(), db: Session = Depends(get_db)):
    try:
        result = subprocess.run(
            ["rasa", "train"],
            capture_output=True,
            text=True,
            cwd=PROJECT_DIR,
            timeout=300,
        )

        if result.returncode == 0:
            model_files = sorted(glob.glob(os.path.join(PROJECT_DIR, "models", "*.tar.gz")))
            version = os.path.basename(model_files[-1]) if model_files else "unknown"

            model_version = ModelVersion(
                version=version,
                training_data_size=None,
                status="active",
            )
            db.add(model_version)
            db.commit()

            return {
                "status": "success",
                "message": "Model trained successfully",
                "version": version,
                "output": result.stdout[-500:] if result.stdout else "",
            }
        else:
            failed_version = ModelVersion(
                version="failed",
                status="failed",
            )
            db.add(failed_version)
            db.commit()

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
    try:
        result = subprocess.run(
            ["rasa", "test", "nlu", "--out", "results/"],
            capture_output=True,
            text=True,
            cwd=PROJECT_DIR,
            timeout=120,
        )

        return {
            "status": "completed",
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
