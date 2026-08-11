import { useEffect, useState } from 'react';

import { BASE, getAccessToken } from '../../api/client';

const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Attachment = ({ attachment }) => {
    const [objectUrl, setObjectUrl] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let url;
        let cancelled = false;

        (async () => {
            try {
                const res = await fetch(`${BASE}${attachment.url}`, {
                    headers: { Authorization: `Bearer ${getAccessToken()}` },
                    credentials: 'include',
                });
                if (!res.ok) throw new Error('Failed to load attachment');
                const blob = await res.blob();
                if (cancelled) return;
                url = URL.createObjectURL(blob);
                setObjectUrl(url);
            } catch {
                if (!cancelled) setFailed(true);
            }
        })();

        return () => {
            cancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, [attachment.url]);

    if (failed) return <p className='message-attachment-error'>Failed to load attachment</p>;
    if (!objectUrl) return <p className='message-attachment-loading'>Loading attachment…</p>;

    if (attachment.mimeType.startsWith('image/')) {
        return (
            <a href={objectUrl} target='_blank' rel='noreferrer' className='message-attachment-link'>
                <img className='message-attachment-image' src={objectUrl} alt={attachment.originalName} />
            </a>
        );
    }

    return (
        <a href={objectUrl} download={attachment.originalName} className='message-attachment-file'>
            📎 {attachment.originalName}
            <span className='message-attachment-size'>({formatSize(attachment.size)})</span>
        </a>
    );
};

export default Attachment;
