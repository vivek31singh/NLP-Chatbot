import { useState, useEffect } from 'react'
import { adminApi, handoffApi, UncertainPrediction, IntentWithPhrases, HandoffItem } from '../services/api'
import { Brain, Tag, Play, CheckCircle, AlertCircle, RefreshCw, BookOpen, Users, ChevronDown, ChevronRight, Plus, Send, XCircle } from 'lucide-react'

export default function AdminPage() {
  const [uncertainPredictions, setUncertainPredictions] = useState<UncertainPrediction[]>([])
  const [intents, setIntents] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [annotating, setAnnotating] = useState<string | null>(null)
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'annotate' | 'training' | 'handoff' | 'train'>('annotate')
  const [modelVersions, setModelVersions] = useState<Array<{version: string; status: string; created_at: string}>>([])

  const [intentsWithPhrases, setIntentsWithPhrases] = useState<IntentWithPhrases[]>([])
  const [expandedIntent, setExpandedIntent] = useState<string | null>(null)
  const [newPhrase, setNewPhrase] = useState<Record<string, string>>({})
  const [addingPhrase, setAddingPhrase] = useState<string | null>(null)

  const [handoffs, setHandoffs] = useState<HandoffItem[]>([])
  const [acceptedHandoff, setAcceptedHandoff] = useState<number | null>(null)
  const [agentMessage, setAgentMessage] = useState('')
  const [agentId, setAgentId] = useState('admin')

  useEffect(() => {
    loadUncertainPredictions()
    loadIntents()
    loadModelVersions()
  }, [])

  useEffect(() => {
    if (activeTab === 'training') {
      loadIntentsWithPhrases()
    }
    if (activeTab === 'handoff') {
      loadHandoffs()
    }
  }, [activeTab])

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

  const loadIntents = async () => {
    try {
      const res = await adminApi.getIntents()
      if (res.data.intents) {
        setIntents(res.data.intents)
      }
    } catch (error) {
      console.error('Failed to load intents:', error)
    }
  }

  const loadModelVersions = async () => {
    try {
      const res = await adminApi.getModelVersions()
      if (Array.isArray(res.data)) {
        setModelVersions(res.data)
      }
    } catch (error) {
      console.error('Failed to load model versions:', error)
    }
  }

  const loadIntentsWithPhrases = async () => {
    try {
      const res = await adminApi.getIntentsWithPhrases()
      setIntentsWithPhrases(res.data)
    } catch (error) {
      console.error('Failed to load intents with phrases:', error)
    }
  }

  const loadHandoffs = async () => {
    try {
      const res = await handoffApi.getPending()
      setHandoffs(res.data)
    } catch (error) {
      console.error('Failed to load handoffs:', error)
    }
  }

  const handleAnnotate = async (prediction: UncertainPrediction, correctIntent: string) => {
    setAnnotating(prediction.id)
    try {
      const res = await adminApi.annotatePrediction({
        text: prediction.text,
        correct_intent: correctIntent,
      })
      if (res.data.written_to_nlu) {
        setUncertainPredictions((prev) => prev.filter((p) => p.id !== prediction.id))
      } else {
        setUncertainPredictions((prev) => prev.filter((p) => p.id !== prediction.id))
      }
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
      if (res.data.status === 'success') {
        loadModelVersions()
      }
    } catch (error) {
      setTrainingStatus('error')
    }
  }

  const handleAddPhrase = async (intent: string) => {
    const phrase = newPhrase[intent]?.trim()
    if (!phrase) return

    setAddingPhrase(intent)
    try {
      await adminApi.addTrainingPhrase(intent, phrase)
      setNewPhrase((prev) => ({ ...prev, [intent]: '' }))
      loadIntentsWithPhrases()
    } catch (error) {
      console.error('Failed to add phrase:', error)
    } finally {
      setAddingPhrase(null)
    }
  }

  const handleAcceptHandoff = async (id: number) => {
    try {
      await handoffApi.accept(id, agentId)
      setAcceptedHandoff(id)
      loadHandoffs()
    } catch (error) {
      console.error('Failed to accept handoff:', error)
    }
  }

  const handleSendAgentMessage = async (id: number) => {
    const msg = agentMessage.trim()
    if (!msg) return

    try {
      await handoffApi.sendMessage(id, agentId, msg)
      setAgentMessage('')
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleCloseHandoff = async (id: number) => {
    try {
      await handoffApi.close(id, agentId)
      setAcceptedHandoff(null)
      loadHandoffs()
    } catch (error) {
      console.error('Failed to close handoff:', error)
    }
  }

  const tabs = [
    { id: 'annotate' as const, label: 'Annotate', icon: Tag },
    { id: 'training' as const, label: 'Training Data', icon: BookOpen },
    { id: 'handoff' as const, label: 'Handoff Queue', icon: Users },
    { id: 'train' as const, label: 'Train Model', icon: Play },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Panel</h1>

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
            These messages had low confidence predictions. Assign the correct intent and the example will be added to the training data.
          </p>

          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : uncertainPredictions.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
              <p className="text-gray-500">No uncertain predictions to annotate.</p>
              <p className="text-sm text-gray-400 mt-1">
                Start chatting with the bot to generate predictions. Downvoted responses will also appear here.
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
                        {intents.map((intent) => (
                          <option key={intent} value={intent}>{intent}</option>
                        ))}
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

      {activeTab === 'training' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Training Data</h2>
            <button
              onClick={loadIntentsWithPhrases}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            View and manage training phrases for each intent. Expand an intent to see its phrases and add new ones.
          </p>

          {intentsWithPhrases.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-2">
              {intentsWithPhrases.map((item) => (
                <div key={item.intent} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedIntent(expandedIntent === item.intent ? null : item.intent)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedIntent === item.intent ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="font-medium text-gray-900">{item.intent}</span>
                    </div>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {item.phrases.length} phrases
                    </span>
                  </button>

                  {expandedIntent === item.intent && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                      <div className="space-y-1 mb-4">
                        {item.phrases.map((phrase, idx) => (
                          <div key={idx} className="text-sm text-gray-700 py-1 px-2">
                            - {phrase}
                          </div>
                        ))}
                        {item.phrases.length === 0 && (
                          <p className="text-sm text-gray-400 italic">No phrases found.</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newPhrase[item.intent] || ''}
                          onChange={(e) => setNewPhrase((prev) => ({ ...prev, [item.intent]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddPhrase(item.intent)
                          }}
                          placeholder="Add a new training phrase..."
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={() => handleAddPhrase(item.intent)}
                          disabled={addingPhrase === item.intent || !newPhrase[item.intent]?.trim()}
                          className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                          {addingPhrase === item.intent ? 'Adding...' : 'Add'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'handoff' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Handoff Queue</h2>
            <button
              onClick={loadHandoffs}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm font-medium text-gray-700">Agent ID:</label>
            <input
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-40"
            />
          </div>

          {handoffs.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
              <p className="text-gray-500">No pending handoffs in the queue.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {handoffs.map((handoff) => (
                <div key={handoff.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        Conversation: <span className="font-mono text-sm text-blue-600">{handoff.conversation_id}</span>
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Queued: {new Date(handoff.queued_at).toLocaleString()}
                      </p>
                      {handoff.reason && (
                        <p className="text-sm text-gray-600 mt-1">
                          Reason: {handoff.reason}
                        </p>
                      )}
                      {handoff.sender_id && (
                        <p className="text-sm text-gray-500 mt-1">
                          Sender: {handoff.sender_id}
                        </p>
                      )}
                    </div>
                    {acceptedHandoff !== handoff.id && (
                      <button
                        onClick={() => handleAcceptHandoff(handoff.id)}
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium"
                      >
                        Accept
                      </button>
                    )}
                  </div>

                  {acceptedHandoff === handoff.id && (
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={agentMessage}
                          onChange={(e) => setAgentMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendAgentMessage(handoff.id)
                          }}
                          placeholder="Type a message to the user..."
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={() => handleSendAgentMessage(handoff.id)}
                          disabled={!agentMessage.trim()}
                          className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Send className="w-4 h-4" />
                          Send
                        </button>
                        <button
                          onClick={() => handleCloseHandoff(handoff.id)}
                          className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                        >
                          <XCircle className="w-4 h-4" />
                          Close
                        </button>
                      </div>
                      <p className="text-xs text-gray-400">You are now handling this conversation as "{agentId}".</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'train' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Model Training</h2>
          <p className="text-sm text-gray-500 mb-6">
            Retrain the NLU model with the latest training data (including new annotations). This may take a few minutes.
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
                Training completed successfully! Restart Rasa to use the new model.
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
                Load NLU training data from data/nlu.yml (includes new annotations)
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

          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mt-6">
            <h3 className="font-medium text-gray-900 mb-3">Model History</h3>
            {modelVersions.length === 0 ? (
              <p className="text-sm text-gray-500">No model versions found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Version</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelVersions.map((mv) => (
                      <tr key={mv.version} className="border-b border-gray-100">
                        <td className="py-2 px-3 font-mono text-gray-900">{mv.version}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            mv.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {mv.status === 'success' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {mv.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-500">{new Date(mv.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
