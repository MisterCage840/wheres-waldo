import React, { useEffect, useMemo, useRef, useState } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:5000"

function resolveImageUrl(url) {
  if (!url) return ""
  if (/^https?:\/\//i.test(url)) return url
  return new URL(url, API).toString()
}

function msToTime(ms) {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n))
}

function getNormalizedPointFromEvent(e, imgEl) {
  const rect = imgEl.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  return { x: clamp01(x), y: clamp01(y) }
}

function makeBox(point, boxSize = 0.06) {
  const half = boxSize / 2
  return {
    xMin: clamp01(point.x - half),
    yMin: clamp01(point.y - half),
    xMax: clamp01(point.x + half),
    yMax: clamp01(point.y + half),
  }
}

export default function App() {
  const imgRef = useRef(null)
  const toastTimerRef = useRef(null)

  const [images, setImages] = useState([])
  const [imagesError, setImagesError] = useState("")
  const [selectedImageId, setSelectedImageId] = useState("")
  const [imageDetail, setImageDetail] = useState(null)

  const [roundId, setRoundId] = useState("")
  const [startedAtLocal, setStartedAtLocal] = useState(null)
  const [finishedMs, setFinishedMs] = useState(null)

  const [overlayOpen, setOverlayOpen] = useState(false)
  const [overlayBox, setOverlayBox] = useState(null)
  const [selectedCharacter, setSelectedCharacter] = useState("")

  const [markers, setMarkers] = useState([]) // {name,x,y} normalized
  const [scores, setScores] = useState([])
  const [nameInput, setNameInput] = useState("")
  const [scoreSubmitted, setScoreSubmitted] = useState(false)
  const [toast, setToast] = useState(null)

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`${API}/api/images`, { credentials: "include" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!Array.isArray(data)) throw new Error("Invalid images response")
        setImages(data)
        setImagesError("")
        if (data?.[0]?.id) setSelectedImageId(data[0].id)
      } catch (err) {
        setImages([])
        setSelectedImageId("")
        setImagesError(
          `Could not load images from ${API}/api/images. Make sure the server is running and seeded.`,
        )
        console.error(err)
      }
    })()
  }, [])

  useEffect(() => {
    if (!selectedImageId) return
    ;(async () => {
      const res = await fetch(`${API}/api/images/${selectedImageId}`, {
        credentials: "include",
      })
      const data = await res.json()
      setImageDetail(data)

      // reset game UI
      setMarkers([])
      setScores([])
      setRoundId("")
      setFinishedMs(null)
      setStartedAtLocal(null)
      setOverlayOpen(false)
      setOverlayBox(null)
      setSelectedCharacter("")
      setNameInput("")
      setScoreSubmitted(false)

      await loadScores(selectedImageId)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImageId])

  const remainingCharacters = useMemo(() => {
    if (!imageDetail) return []
    const found = new Set(markers.map((m) => m.name))
    return imageDetail.characters.filter((c) => !found.has(c.name))
  }, [imageDetail, markers])

  async function loadScores(imageId) {
    const res = await fetch(`${API}/api/images/${imageId}/scores`, {
      credentials: "include",
    })
    const data = await res.json()
    setScores(data)
  }

  async function startRound() {
    if (!selectedImageId) return

    const res = await fetch(`${API}/api/rounds/start`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId: selectedImageId }),
    })

    const data = await res.json()
    setRoundId(data.id)
    setStartedAtLocal(Date.now())
    setFinishedMs(null)
    setMarkers([])
    setOverlayOpen(false)
    setOverlayBox(null)
    setSelectedCharacter("")
    setNameInput("")
    setScoreSubmitted(false)

    await loadScores(selectedImageId)
  }

  function closeOverlay() {
    setOverlayOpen(false)
    setOverlayBox(null)
    setSelectedCharacter("")
  }

  function onImageClick(e) {
    if (!roundId || finishedMs != null) return
    const img = imgRef.current
    if (!img) return

    const point = getNormalizedPointFromEvent(e, img)
    const box = makeBox(point, 0.06) // tolerance knob
    setOverlayBox(box)
    setOverlayOpen(true)
    setSelectedCharacter("")
  }

  async function submitGuess() {
    if (!roundId || !overlayBox || !selectedCharacter) return

    const res = await fetch(`${API}/api/rounds/${roundId}/guess`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterName: selectedCharacter,
        box: overlayBox,
      }),
    })

    const data = await res.json()

    if (!data.correct) {
      showToast("Wrong spot. Try again.", "error")
      closeOverlay()
      return
    }

    if (data.marker) {
      setMarkers((prev) => {
        if (prev.some((m) => m.name === selectedCharacter)) return prev
        return [
          ...prev,
          { name: selectedCharacter, x: data.marker.x, y: data.marker.y },
        ]
      })
    }

    closeOverlay()

    if (data.finished) {
      setFinishedMs(data.durationMs)
      await loadScores(selectedImageId)
    } else {
      showToast("Found!", "success")
    }
  }

  async function submitHighScore() {
    if (!roundId || !nameInput.trim()) return

    const res = await fetch(`${API}/api/rounds/${roundId}/submit-score`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput.trim() }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showToast(err.error || "Could not submit score", "error", 2500)
      return
    }

    setScoreSubmitted(true)
    await loadScores(selectedImageId)
  }

  function normMarkerStyle(x, y) {
    const img = imgRef.current
    if (!img) return {}
    const rect = img.getBoundingClientRect()
    return { left: `${x * rect.width}px`, top: `${y * rect.height}px` }
  }

  function showToast(message, type = "info", duration = 1800) {
    setToast({ message, type })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), duration)
  }

  function normBoxStyle(box) {
    const img = imgRef.current
    if (!img) return {}
    const rect = img.getBoundingClientRect()

    const left = box.xMin * rect.width
    const top = box.yMin * rect.height
    const width = (box.xMax - box.xMin) * rect.width
    const height = (box.yMax - box.yMin) * rect.height

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    }
  }

  const displayTime = useMemo(() => {
    if (finishedMs != null) return msToTime(finishedMs)
    if (!startedAtLocal) return "0:00"
    return msToTime(Date.now() - startedAtLocal)
  }, [finishedMs, startedAtLocal, tick])

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">Where’s Waldo</h1>

        <div className="controls">
          <label className="control">
            <span className="controlLabel">Image</span>
            <select
              className="select"
              value={selectedImageId}
              onChange={(e) => setSelectedImageId(e.target.value)}
            >
              {!images.length ? (
                <option value="" disabled>
                  No images available
                </option>
              ) : null}
              {images.map((im) => (
                <option key={im.id} value={im.id}>
                  {im.name}
                </option>
              ))}
            </select>
          </label>

          <button
            className="btn"
            onClick={startRound}
            disabled={!selectedImageId}
          >
            {roundId ? "Restart Round" : "Start Round"}
          </button>

          <div className="timer">
            Time: <span className="timerValue">{displayTime}</span>
          </div>
        </div>
      </header>

      <main className="main">
        {imagesError ? (
          <div className="card" style={{ marginBottom: "12px" }}>
            <div className="cardTitle">Image Load Error</div>
            <div className="modalText">{imagesError}</div>
          </div>
        ) : null}
        {imageDetail && (
          <div className="layout">
            <section className="board">
              <div className="imageWrap" onClick={(e) => e.stopPropagation()}>
                <img
                  ref={imgRef}
                  className="gameImage"
                  src={resolveImageUrl(imageDetail.imageUrl)}
                  alt={imageDetail.name}
                  onClick={onImageClick}
                  onLoad={() => setTick((x) => x + 1)}
                />

                {markers.map((m) => (
                  <div
                    key={m.name}
                    className="marker"
                    style={normMarkerStyle(m.x, m.y)}
                  >
                    ✅ {m.name}
                  </div>
                ))}

                {overlayOpen && overlayBox && (
                  <div
                    className="targetBox"
                    style={normBoxStyle(overlayBox)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className={`dropdownCard ${
                        overlayBox.xMax > 0.7 ? "dropdownLeft" : "dropdownRight"
                      } ${overlayBox.yMax > 0.7 ? "dropdownUp" : "dropdownDown"}`}
                    >
                      <div className="dropdownTitle">Select character</div>

                      <select
                        className="select"
                        value={selectedCharacter}
                        onChange={(e) => setSelectedCharacter(e.target.value)}
                      >
                        <option value="">-- choose --</option>
                        {remainingCharacters.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>

                      <div className="dropdownActions">
                        <button
                          className="btn"
                          onClick={submitGuess}
                          disabled={!selectedCharacter}
                        >
                          Check
                        </button>
                        <button className="btn btnGhost" onClick={closeOverlay}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {overlayOpen && (
                <button
                  className="clickAway"
                  onClick={closeOverlay}
                  aria-label="Close overlay"
                />
              )}
            </section>

            <aside className="sidebar">
              <div className="card">
                <div className="cardTitle">Targets</div>
                <ul className="list">
                  {imageDetail.characters.map((c) => {
                    const found = markers.some((m) => m.name === c.name)
                    return (
                      <li key={c.id} className="listItem">
                        <span className="badge">{found ? "✅" : "⬜"}</span>
                        <span>{c.name}</span>
                      </li>
                    )
                  })}
                </ul>

                <div className="hint">
                  {roundId
                    ? finishedMs == null
                      ? "Click the image to open the target box."
                      : "Round complete!"
                    : "Click Start Round to begin."}
                </div>
              </div>

              <div className="card">
                <div className="cardTitle">Leaderboard (Top 10)</div>
                <ol className="scores">
                  {scores.map((s) => (
                    <li key={s.id} className="scoreRow">
                      <span className="scoreName">{s.name}</span>
                      <span className="scoreTime">
                        {msToTime(s.durationMs)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>
        )}
      </main>

      {toast ? (
        <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      ) : null}

      {finishedMs != null && (
        <div className="modalBackdrop">
          <div className="modal">
            <h2 className="modalTitle">🎉 Finished!</h2>
            <p className="modalText">
              Your time: <strong>{msToTime(finishedMs)}</strong>
            </p>

            {!scoreSubmitted ? (
              <>
                <p className="modalText">Enter your name to save your score:</p>
                <input
                  className="input"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={30}
                  placeholder="Your name"
                />
                <div className="modalActions">
                  <button
                    className="btn"
                    onClick={submitHighScore}
                    disabled={!nameInput.trim()}
                  >
                    Submit
                  </button>
                  <button
                    className="btn btnGhost"
                    onClick={() => setFinishedMs(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="modalText">✅ Score saved.</p>
                <div className="modalActions">
                  <button className="btn" onClick={() => setFinishedMs(null)}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
