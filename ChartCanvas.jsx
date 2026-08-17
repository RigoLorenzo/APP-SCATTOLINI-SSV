import { useRef, useEffect, useState } from 'react';

const ChartCanvas = ({ data, title, type = 'bar', height = 450 }) => {
  const canvasRef = useRef(null);
  const [hiddenItems, setHiddenItems] = useState(new Set());
  const legendHitboxes = useRef([]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    for (const box of legendHitboxes.current) {
      if (cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h) {
        setHiddenItems(prev => {
          const next = new Set(prev);
          if (next.has(box.index)) next.delete(box.index);
          else next.add(box.index);
          return next;
        });
        return;
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;

    legendHitboxes.current = [];
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const canvasHeight = canvas.height;
    const padding = { top: 70, right: 30, bottom: 80, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = canvasHeight - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, canvasHeight);

    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    bgGradient.addColorStop(0, '#FAFBFC');
    bgGradient.addColorStop(1, '#F1F5F9');
    ctx.fillStyle = bgGradient;
    ctx.roundRect(0, 0, width, canvasHeight, 16);
    ctx.fill();

    // Title
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 16px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 35);

    // Hint text
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillText('Clicca su un elemento per nasconderlo/mostrarlo', width / 2, 52);

    if (type === 'bar') {
      const maxValue = Math.max(...data.map(d => d.value), 1);
      const barWidth = Math.min((chartWidth / data.length) - 12, 60);
      const barSpacing = (chartWidth - (barWidth * data.length)) / (data.length + 1);

      // Grid lines
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      const gridLines = 5;
      for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        const value = Math.round(maxValue - (maxValue / gridLines) * i);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(value.toString(), padding.left - 10, y + 4);
      }
      ctx.setLineDash([]);

      data.forEach((item, i) => {
        const isHidden = hiddenItems.has(i);
        const barH = (item.value / maxValue) * chartHeight;
        const x = padding.left + barSpacing + i * (barWidth + barSpacing);

        // Store hitbox for label area
        legendHitboxes.current.push({
          index: i,
          x: x - 5,
          y: padding.top + chartHeight + 2,
          w: barWidth + 10,
          h: 55,
        });

        if (!isHidden && barH > 0) {
          const y = padding.top + chartHeight - barH;

          ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 4;

          const gradient = ctx.createLinearGradient(x, y, x, y + barH);
          gradient.addColorStop(0, item.color);
          gradient.addColorStop(0.5, item.colorDark || item.color);
          gradient.addColorStop(1, item.colorDark || item.color);

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barH, [8, 8, 0, 0]);
          ctx.fill();

          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;

          const shineGradient = ctx.createLinearGradient(x, y, x + barWidth, y);
          shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
          shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
          shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = shineGradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth / 2, barH, [8, 0, 0, 0]);
          ctx.fill();

          if (item.value > 0) {
            ctx.fillStyle = '#1E293B';
            ctx.font = 'bold 13px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.value.toString(), x + barWidth / 2, y - 8);
          }
        } else if (isHidden) {
          // Dimmed placeholder
          ctx.globalAlpha = 0.18;
          ctx.fillStyle = item.color;
          ctx.beginPath();
          ctx.roundRect(x, padding.top + chartHeight - 6, barWidth, 6, [3, 3, 0, 0]);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Label
        ctx.globalAlpha = isHidden ? 0.35 : 1;
        ctx.fillStyle = '#64748B';
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.save();
        ctx.translate(x + barWidth / 2, padding.top + chartHeight + 15);
        ctx.rotate(-Math.PI / 6);
        ctx.textAlign = 'right';
        ctx.fillText(item.label, 0, 0);
        ctx.restore();
        ctx.globalAlpha = 1;
      });

    } else if (type === 'pie') {
      const centerX = width / 2 - 60;
      const centerY = canvasHeight / 2 + 10;
      const radius = Math.min(chartWidth, chartHeight) / 2 - 60;

      // Total excludes hidden items
      const total = data.reduce((sum, d, i) => hiddenItems.has(i) ? sum : sum + d.value, 0);
      if (total === 0) {
        ctx.fillStyle = '#94A3B8';
        ctx.font = '14px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Nessun dato visibile', centerX, centerY);
        // Still render legend for re-enabling
      } else {
        let currentAngle = -Math.PI / 2;

        data.forEach((item, i) => {
          const isHidden = hiddenItems.has(i);

          if (!isHidden) {
            const sliceAngle = (item.value / total) * 2 * Math.PI;

            ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;

            const midAngle = currentAngle + sliceAngle / 2;
            const gradientX = centerX + Math.cos(midAngle) * (radius * 0.5);
            const gradientY = centerY + Math.sin(midAngle) * (radius * 0.5);

            const pieGradient = ctx.createRadialGradient(gradientX, gradientY, 0, centerX, centerY, radius);
            pieGradient.addColorStop(0, item.color);
            pieGradient.addColorStop(1, item.colorDark || item.color);

            ctx.fillStyle = pieGradient;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fill();

            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.stroke();

            if ((item.value / total) > 0.05) {
              const labelAngle = currentAngle + sliceAngle / 2;
              const labelRadius = radius * 0.65;
              const lx = centerX + Math.cos(labelAngle) * labelRadius;
              const ly = centerY + Math.sin(labelAngle) * labelRadius;

              ctx.fillStyle = '#FFFFFF';
              ctx.font = 'bold 14px Inter, system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              const percentage = Math.round((item.value / total) * 100);
              ctx.fillText(`${percentage}%`, lx, ly);
            }

            currentAngle += sliceAngle;
          }
        });

        // Donut hole
        ctx.fillStyle = '#FAFBFC';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = 'transparent';

        ctx.fillStyle = '#1E293B';
        ctx.font = 'bold 28px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(total.toString(), centerX, centerY - 8);
        ctx.fillStyle = '#64748B';
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.fillText('TOTALE', centerX, centerY + 14);
      }

      // Legend (always rendered for interactivity)
      data.forEach((item, i) => {
        const isHidden = hiddenItems.has(i);
        const legendX = width - 140;
        const legendY = 80 + i * 32;

        legendHitboxes.current.push({
          index: i,
          x: legendX - 10,
          y: legendY - 14,
          w: 155,
          h: 28,
        });

        ctx.globalAlpha = isHidden ? 0.4 : 1;

        // Dot
        ctx.fillStyle = isHidden ? '#CBD5E1' : item.color;
        ctx.beginPath();
        ctx.arc(legendX, legendY, 8, 0, Math.PI * 2);
        ctx.fill();

        // Text
        ctx.fillStyle = isHidden ? '#94A3B8' : '#334155';
        ctx.font = '13px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const labelText = item.label.length > 12 ? item.label.substring(0, 12) + '...' : item.label;
        const displayText = `${labelText} (${item.value})`;
        ctx.fillText(displayText, legendX + 16, legendY);

        // Strikethrough for hidden
        if (isHidden) {
          const textWidth = ctx.measureText(displayText).width;
          ctx.beginPath();
          ctx.moveTo(legendX + 16, legendY);
          ctx.lineTo(legendX + 16 + textWidth, legendY);
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
      });
    }
  }, [data, title, type, hiddenItems]);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 hover:shadow-xl transition-shadow duration-300">
      <canvas
        ref={canvasRef}
        width={700}
        height={height}
        className="max-w-full h-auto mx-auto cursor-pointer select-none"
        onClick={handleCanvasClick}
      />
    </div>
  );
};


export default ChartCanvas;
