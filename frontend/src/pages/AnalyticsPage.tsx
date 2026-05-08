import { useState, useEffect } from 'react'
import { Bar, Line, Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip as ChartTooltip, Legend as ChartLegend,
  Filler,
} from 'chart.js'
import axios from 'axios'
import { analyticsApi, AnalyticsOverview, IntentMetric } from '../services/api'
import { MessageSquare, TrendingUp, Target, ThumbsUp, AlertTriangle, Activity, Brain, CheckCircle, Loader2 } from 'lucide-react'

interface F1Scores {
  weighted: number | null
  macro: number | null
  micro: number | null
  accuracy: number | null
}

interface IntentReportEntry {
  precision: number | null
  recall: number | null
  f1_score: number | null
  support: number | null
}

interface EvaluationResult {
  f1_scores: F1Scores
  confusion_matrix_url: string | null
  intent_report: Record<string, IntentReportEntry>
  note: string | null
}

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, ChartTooltip, ChartLegend, Filler
)

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [intents, setIntents] = useState<IntentMetric[]>([])
  const [trend, setTrend] = useState<{ date: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null)
  const [evalLoading, setEvalLoading] = useState(false)
  const [evalError, setEvalError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [overviewRes, intentsRes, trendRes] = await Promise.all([
        analyticsApi.getOverview(),
        analyticsApi.getIntents(),
        analyticsApi.getConversationTrend(30),
      ])
      setOverview(overviewRes.data)
      setIntents(intentsRes.data)
      setTrend(trendRes.data)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const runEvaluation = async () => {
    setEvalLoading(true)
    setEvalError(null)
    setEvalResult(null)
    try {
      const res = await axios.get<EvaluationResult>('/api/v1/analytics/evaluation')
      setEvalResult(res.data)
    } catch (error) {
      console.error('Failed to run evaluation:', error)
      setEvalError('Failed to run evaluation. Please try again.')
    } finally {
      setEvalLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score > 0.85) return { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' }
    if (score > 0.7) return { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' }
    return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    )
  }

  const kpiCards = [
    { label: 'Total Conversations', value: overview?.total_conversations || 0, icon: MessageSquare, color: 'blue' },
    { label: 'Bot Resolution Rate', value: `${overview?.bot_resolution_rate || 0}%`, icon: Target, color: 'green' },
    { label: 'Avg Confidence', value: `${((overview?.avg_confidence || 0) * 100).toFixed(1)}%`, icon: TrendingUp, color: 'purple' },
    { label: 'Fallback Rate', value: `${overview?.fallback_rate || 0}%`, icon: AlertTriangle, color: 'orange' },
    { label: 'Avg Satisfaction', value: overview?.avg_satisfaction ? `${overview.avg_satisfaction}/5` : 'N/A', icon: ThumbsUp, color: 'pink' },
    { label: 'Total Messages', value: overview?.total_messages || 0, icon: Activity, color: 'cyan' },
  ]

  const intentChartData = {
    labels: intents.map((i) => i.intent),
    datasets: [
      {
        label: 'Count',
        data: intents.map((i) => i.count),
        backgroundColor: COLORS.slice(0, intents.length),
        borderRadius: 4,
      },
    ],
  }

  const trendChartData = {
    labels: trend.map((t) => t.date),
    datasets: [
      {
        label: 'Conversations',
        data: trend.map((t) => t.count),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  }

  const confidenceChartData = {
    labels: intents.map((i) => i.intent),
    datasets: [
      {
        label: 'Avg Confidence',
        data: intents.map((i) => Math.round(i.avg_confidence * 100)),
        backgroundColor: intents.map((i) =>
          i.avg_confidence > 0.8 ? '#10B981' : i.avg_confidence > 0.5 ? '#F59E0B' : '#EF4444'
        ),
        borderRadius: 4,
      },
    ],
  }

  const pieChartData = {
    labels: intents.map((i) => i.intent),
    datasets: [
      {
        data: intents.map((i) => i.count),
        backgroundColor: COLORS.slice(0, intents.length),
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 10 } },
      },
      y: {
        ticks: { font: { size: 12 } },
      },
    },
  }

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 10 }, maxRotation: 45 },
      },
      y: {
        ticks: { font: { size: 12 } },
        beginAtZero: true,
      },
    },
  }

  const confidenceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 10 }, maxRotation: 45 },
      },
      y: {
        ticks: { font: { size: 12 } },
        min: 0,
        max: 100,
      },
    },
  }

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: { font: { size: 11 } },
      },
    },
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {kpiCards.map((card) => {
          const Icon = card.icon
          const colorClasses: Record<string, string> = {
            blue: 'bg-blue-50 text-blue-700',
            green: 'bg-green-50 text-green-700',
            purple: 'bg-purple-50 text-purple-700',
            orange: 'bg-orange-50 text-orange-700',
            pink: 'bg-pink-50 text-pink-700',
            cyan: 'bg-cyan-50 text-cyan-700',
          }
          return (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorClasses[card.color]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-1">{card.label}</p>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversation Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversation Trend (30 days)</h3>
          <div style={{ height: 300 }}>
            <Line data={trendChartData} options={trendChartOptions} />
          </div>
        </div>

        {/* Intent Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Intent Distribution</h3>
          <div style={{ height: 300 }}>
            <Bar data={intentChartData} options={chartOptions} />
          </div>
        </div>

        {/* Confidence Scores */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Intent Confidence Scores</h3>
          <div style={{ height: 300 }}>
            <Bar data={confidenceChartData} options={confidenceChartOptions} />
          </div>
        </div>

        {/* Intent Pie Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Intent Share</h3>
          <div style={{ height: 300 }}>
            <Pie data={pieChartData} options={pieChartOptions} />
          </div>
        </div>

        {/* Summary Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Intent Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Intent</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Count</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Avg Confidence</th>
                </tr>
              </thead>
              <tbody>
                {intents.map((intent) => (
                  <tr key={intent.intent} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-gray-900">{intent.intent}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{intent.count}</td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${intent.avg_confidence > 0.8
                            ? 'bg-green-100 text-green-700'
                            : intent.avg_confidence > 0.5
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                      >
                        {(intent.avg_confidence * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {intents.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-400">
                      No data yet. Start chatting to see analytics.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* NLU Evaluation Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">NLU Evaluation</h2>
          </div>
          <button
            onClick={runEvaluation}
            disabled={evalLoading}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {evalLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running Evaluation...
              </>
            ) : (
              'Run Evaluation'
            )}
          </button>
        </div>

        {evalError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{evalError}</p>
          </div>
        )}

        {evalLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-gray-500 text-sm">Running NLU evaluation... This may take a few minutes.</p>
          </div>
        )}

        {evalResult && !evalLoading && (
          <>
            {evalResult.note && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                <p className="text-sm text-yellow-700">{evalResult.note}</p>
              </div>
            )}

            {/* F1 Score Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {([
                { label: 'Weighted F1', value: evalResult.f1_scores.weighted },
                { label: 'Macro F1', value: evalResult.f1_scores.macro },
                { label: 'Micro F1', value: evalResult.f1_scores.micro },
                { label: 'Accuracy', value: evalResult.f1_scores.accuracy },
              ] as const).map((item) => {
                const score = item.value ?? null
                const colors = score != null ? getScoreColor(score) : { bg: 'bg-gray-100', text: 'text-gray-400', dot: 'bg-gray-300' }
                return (
                  <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-3 h-3 rounded-full ${colors.dot}`} />
                      <p className="text-xs text-gray-500 font-medium">{item.label}</p>
                    </div>
                    <p className={`text-2xl font-bold ${colors.text}`}>
                      {score != null ? `${(score * 100).toFixed(1)}%` : 'N/A'}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Confusion Matrix */}
              {evalResult.confusion_matrix_url && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Confusion Matrix</h3>
                  <div className="flex items-center justify-center">
                    <img
                      src={evalResult.confusion_matrix_url}
                      alt="Confusion Matrix"
                      className="max-w-full rounded-lg border border-gray-100"
                    />
                  </div>
                </div>
              )}

              {/* Intent Report Table */}
              <div className={`bg-white rounded-xl border border-gray-200 p-6 ${!evalResult.confusion_matrix_url ? 'lg:col-span-2' : ''}`}>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Per-Intent Report</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Intent</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-500">Precision</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-500">Recall</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-500">F1 Score</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-500">Support</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(evalResult.intent_report).map(([intent, metrics]) => {
                        const f1 = metrics.f1_score ?? 0
                        const colors = getScoreColor(f1)
                        return (
                          <tr key={intent} className="border-b border-gray-100">
                            <td className="py-2 px-3 text-gray-900 font-medium">{intent}</td>
                            <td className="py-2 px-3 text-right text-gray-600">{metrics.precision != null ? `${(metrics.precision * 100).toFixed(1)}%` : 'N/A'}</td>
                            <td className="py-2 px-3 text-right text-gray-600">{metrics.recall != null ? `${(metrics.recall * 100).toFixed(1)}%` : 'N/A'}</td>
                            <td className="py-2 px-3 text-right">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                                {metrics.f1_score != null ? `${(metrics.f1_score * 100).toFixed(1)}%` : 'N/A'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right text-gray-600">{metrics.support ?? 0}</td>
                          </tr>
                        )
                      })}
                      {Object.keys(evalResult.intent_report).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-400">
                            No intent report data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
