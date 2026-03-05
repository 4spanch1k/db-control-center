"use client";

import { PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./prism-flux-loader.module.css";

interface PrismFluxLoaderProps {
  size?: number;
  speed?: number;
  textSize?: number;
}

const STATUSES = ["Fetching", "Fixing", "Updating", "Placing", "Syncing", "Processing"];

export function PrismFluxLoader({ size = 30, speed = 5, textSize = 14 }: PrismFluxLoaderProps) {
  const [time, setTime] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTime((previous) => previous + 0.02 * speed);
    }, 16);

    return () => {
      window.clearInterval(interval);
    };
  }, [speed]);

  useEffect(() => {
    const statusInterval = window.setInterval(() => {
      setStatusIndex((previous) => (previous + 1) % STATUSES.length);
    }, 600);

    return () => {
      window.clearInterval(statusInterval);
    };
  }, []);

  const half = size / 2;
  const currentStatus = STATUSES[statusIndex];
  const iconSize = useMemo(() => Math.max(12, Math.round(size * 0.42)), [size]);

  const faceTransforms = [
    `rotateY(0deg) translateZ(${half}px)`,
    `rotateY(180deg) translateZ(${half}px)`,
    `rotateY(90deg) translateZ(${half}px)`,
    `rotateY(-90deg) translateZ(${half}px)`,
    `rotateX(90deg) translateZ(${half}px)`,
    `rotateX(-90deg) translateZ(${half}px)`,
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.scene}>
        <div
          className={styles.cube}
          style={{
            width: size,
            height: size,
            transform: `rotateY(${time * 30}deg) rotateX(${time * 30}deg)`,
          }}
        >
          {faceTransforms.map((transform, index) => (
            <div
              key={transform}
              className={styles.face}
              style={{
                width: size,
                height: size,
                transform,
                opacity: 0.72 + index * 0.04,
              }}
            >
              <PlusIcon size={iconSize} strokeWidth={2.2} />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.status} style={{ fontSize: textSize }}>
        {currentStatus}...
      </div>
    </div>
  );
}
