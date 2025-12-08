import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

interface MaskedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function MaskedInput({ label, ...props }: MaskedInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1">
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="relative">
        <Input type={visible ? 'text' : 'password'} className="pr-10 font-mono" {...props} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3"
          onClick={() => setVisible(!visible)}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
