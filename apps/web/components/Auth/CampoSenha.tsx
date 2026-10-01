'use client'

import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export interface CampoSenhaProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const CampoSenha = React.forwardRef<HTMLInputElement, CampoSenhaProps>(
  ({ className = '', ...props }, ref) => {
    const [visivel, setVisivel] = useState(false)

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          type={visivel ? 'text' : 'password'}
          className={`${className} pe-10`}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisivel((prev) => !prev)}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70 focus:outline-none transition-colors"
        >
          {visivel ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    )
  }
)

CampoSenha.displayName = 'CampoSenha'

export default CampoSenha
