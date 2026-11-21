import { useEffect } from 'react'
import { createMotorSound } from '../../site/console/motor.js'

let motor: ReturnType<typeof createMotorSound> | undefined

export function useMotorHum(head: boolean, leg = false) {
  useEffect(() => {
    motor ??= createMotorSound()
    const update = () => motor?.update(head, leg)
    update()
    document.addEventListener('pointerdown', update)
    document.addEventListener('keydown', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      document.removeEventListener('pointerdown', update)
      document.removeEventListener('keydown', update)
      document.removeEventListener('visibilitychange', update)
      motor?.update(false, false)
    }
  }, [head, leg])
}
