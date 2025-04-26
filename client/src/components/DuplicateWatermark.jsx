import React from 'react';

const DuplicateWatermark = () => {
    const watermarkStyle = {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(-45deg)',
        fontSize: '80px',
        fontWeight: 'bold',
        color: 'rgba(220, 53, 69, 0.2)',
        zIndex: 1000,
        pointerEvents: 'none',
        userSelect: 'none',
        display: 'none',
        "@media print": {
            display: 'block'
        }
    };

    return (
        <div style={watermarkStyle} className="duplicate-watermark print-only">
            DUPLICATE
        </div>
    );
};

export default DuplicateWatermark;