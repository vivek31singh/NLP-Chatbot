import { useState, useEffect } from 'react'
import { adminApi, UncertainPrediction } from '../services/api'
import { Brain, Tag, Play, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'

export default function AdminPage() {
  const [uncertainPredictions, setUncertainPredictions] = useState<UncertainPrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [annotating, setAnnotating] = useState<string | null>(null)
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'annotate' | 'train'>('annotate')

  useEffect(() => {
    loadUncertainPredictions()
  }, [])

  const loadUncertainPredictions = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getUncertainPredictions(50)
      setUncertainPredictions(res.data)
    } catch (error) {
      console.error('Failed to load predictions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAnnotate = async (prediction: UncertainPrediction, correctIntent: string) => {
    setAnnotating(prediction.id)
    try {
      await adminApi.annotatePrediction({
        text: prediction.text,
        correct_intent: correctIntent,
      })
      setUncertainPredictions((prev) => prev.filter((p) => p.id !== prediction.id))
    } catch (error) {
      console.error('Failed to annotate:', error)
    } finally {
      setAnnotating(null)
    }
  }

  const handleTrain = async () => {
    setTrainingStatus('training')
    try {
      const res = await adminApi.trainModel()
      setTrainingStatus(res.data.status === 'success' ? 'success' : 'error')
    } catch (error) {
      setTrainingStatus('error')
    }
  }

  const tabs = [
    { id: 'annotate' as const, label: 'Annotate', icon: Tag },
    { id: 'train' as const, label: 'Train Model', icon: Play },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Panel</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Annotate Tab */}
      {activeTab === 'annotate' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Active Learning - Annotate Uncertain Predictions
            </h2>
            <button
              onClick={loadUncertainPredictions}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            These messages had low confidence predictions. Help the bot by assigning the correct intent.
          </p>

          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : uncertainPredictions.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
              <p className="text-gray-500">No uncertain predictions to annotate.</p>
              <p className="text-sm text-gray-400 mt-1">
                Start chatting with the bot to generate predictions.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {uncertainPredictions.map((prediction) => (
                <div
                  key={prediction.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-900 font-medium">"{prediction.text}"</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-sm text-gray-500">
                          Predicted: <span className="font-medium text-blue-600">{prediction.predicted_intent}</span>
                        </span>
                        <span className="text-sm text-gray-500">
                          Confidence: <span className="font-medium">{(prediction.confidence * 100).toFixed(1)}%</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        Correct intent:
                      </span>
                      <select
                        defaultValue={prediction.predicted_intent}
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                        id={`intent-${prediction.id}`}
                      >
                        <option value="greet">greet</option>
                        <option value="goodbye">goodbye</option>
                        <option value="check_order_status">check_order_status</option>
                        <option value="track_order">track_order</option>
                        <option value="return_refund">return_refund</option>
                        <option value="product_inquiry">product_inquiry</option>
                        <option value="billing_question">billing_question</option>
                        <option value="complaint">complaint</option>
                        <option value="handoff_to_human">handoff_to_human</option>
                        <option value="out_of_scope">out_of_scope</option>
                      </select>
                      <button
                        onClick={() => {
                          const select = document.getElementById(`intent-${prediction.id}`) as HTMLSelectElement
                          handleAnnotate(prediction, select.value)
                        }}
                        disabled={annotating === prediction.id}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {annotating === prediction.id ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Train Tab */}
      {activeTab === 'train' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Model Training</h2>
          <p className="text-sm text-gray-500 mb-6">
            Retrain the NLU model with the latest training data. This may take a few minutes.
          </p>

          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleTrain}
              disabled={trainingStatus === 'training'}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              <Brain className="w-5 h-5" />
              {trainingStatus === 'training' ? 'Training...' : 'Train Model'}
            </button>
            {trainingStatus === 'success' && (
              <span className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                Training completed successfully!
              </span>
            )}
            {trainingStatus === 'error' && (
              <span className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5" />
                Training failed. Check logs for details.
              </span>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium text-gray-900 mb-2">Training Pipeline</h3>
            <ol className="text-sm text-gray-600 space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">1</span>
                Load NLU training data from data/nlu.yml
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">2</span>
                Train DIETClassifier (intent + entity joint model)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">3</span>
                Train ResponseSelector (FAQ/chitchat retrieval)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">4</span>
                Train dialogue policies (TEDPolicy, RulePolicy)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">5</span>
                Save model to models/ directory
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
