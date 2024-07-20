import 'leaflet/dist/leaflet.css'
import './TrackViewer.css'
import useResizeObserver from '@react-hook/resize-observer'
import { Map as LMap } from "leaflet"
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet'
import { useEffect, useRef, useState } from 'react'
import { ErrorType, jsonPost } from 'functional-extensions'
import { LatLngExpression } from 'leaflet'

type TrackInfo = {
    name?: string
    description?: string
    distance: number,
    duration: number,
    averageSpeed: number,
    averageHeartRate: number,
    trackPoints?: TrackPoint[] 
}

type TrackPoint = {
    latitude?: number
    longitude?: number
    elevation?: number
    time?: Date
    heartrate?: number
    velocity?: number
}

type TrackViewerProps = {
    path: string
}

const TrackViewer = ({ path }: TrackViewerProps) => {

    const myMap = useRef<LMap | null>(null)
    const root = useRef<HTMLDivElement>(null)
    const [track, setTrack] = useState<number[][]>([[0, 0]])
    const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([])
    const [pointCount, setPointCount] = useState(0)
    const [position, setPosition] = useState(0)
    const [heartRate, setHeartRate] = useState(0)
    const [velocity, setVelocity] = useState(0)
    const [averageVelocity, setAverageVelocity] = useState(0)
    const [averageHeartRate, setAverageHeartRate] = useState(0)
    const [maxVelocity, setMaxVelocity] = useState(0)
    const [maxHeartRate, setMaxHeartRate] = useState(0)
    const [distance, setDistance] = useState(0)
    const [duration, setDuration] = useState(0)

    
    useEffect(() => {
        jsonPost<TrackInfo, ErrorType>({ method: "gettrackinfo", payload: { path } })
            .match(n => {
                setPosition(0)
                setPointCount(n.trackPoints?.length ?? 0)
                if (n.trackPoints)
                    setTrackPoints(n.trackPoints)
                setAverageVelocity(n.averageSpeed)
                setAverageHeartRate(n.averageHeartRate)
                setDistance(n.distance)
                setDuration(n.duration)
                const trk = n.trackPoints?.map(n => [n.latitude!, n.longitude!])
                if (trk) {
                    setTrack(trk)
                    const maxLat = trk.reduce((prev, curr) => Math.max(prev, curr[0]), trk[0][0])
                    const minLat = trk.reduce((prev, curr) => Math.min(prev, curr[0]), trk[0][0])
                    const maxLng = trk.reduce((prev, curr) => Math.max(prev, curr[1]), trk[0][1])
                    const minLng = trk.reduce((prev, curr) => Math.min(prev, curr[1]), trk[0][1])
                    setMaxVelocity(n.trackPoints?.max(t => t.velocity ?? 0) ?? 0)
                    setMaxHeartRate(n.trackPoints?.max(t => t.heartrate ?? 0)?? 0)
                    myMap.current?.fitBounds([[maxLat, maxLng], [minLat, minLng]])
                }
            }, e => console.error(e))
    }, [path])

    useResizeObserver(root.current, () => {
        myMap.current?.invalidateSize({ debounceMoveend: true, animate: true })    
    })

    const onPosition = (pos: number) => {
        setPosition(pos)
        setHeartRate(trackPoints[pos].heartrate ?? 0)
        setVelocity(trackPoints[pos].velocity ?? 0)
    }

    const onMaxHeartRate = () => {
        var i = trackPoints.findIndex(n => n.heartrate == maxHeartRate)
        if (i != -1)
            onPosition(i)
    }

    const onMaxVelocity = () => {
        var i = trackPoints.findIndex(n => n.velocity == maxVelocity)
        if (i != -1)
            onPosition(i)
    }

    return (
        <div className="trackView" ref={root}>
            <MapContainer className='track' ref={myMap} center={[0, 0]} zoom={13} scrollWheelZoom={true} >
                <TileLayer attribution='' url="https://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png" />
                <Marker position={track[position] as LatLngExpression}></Marker> 
                <Polyline pathOptions={{ fillColor: 'red', color: 'blue' }}
                    positions={track as LatLngExpression[]}/>
            </MapContainer>
            <div className="trackPopup bottom">
                <div>{velocity.toFixed(1)} km/h</div>
                <div>❤️ {heartRate}</div>
            </div>
            <div className="trackPopup ">
                <div>{distance.toFixed(1)} km</div>
                <div>{duration}</div>
                <div>Ø {averageVelocity.toFixed(1)} km/h</div>
                <div className="button" onClick={() => onMaxVelocity()}>Max {maxVelocity.toFixed(1)} km/h</div>
                <div>Ø❤️ {averageHeartRate}</div>
                <div className="button" onClick={() => onMaxHeartRate()}>Max❤️ {maxHeartRate}</div>
            </div>
            <input type="range" min="1" max={pointCount} value={position} onChange={n => onPosition(Number.parseInt(n.target.value)-1)}></input>
        </div>
    )
}

export default TrackViewer



