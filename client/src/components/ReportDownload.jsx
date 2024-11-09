import axios from 'axios';

const downloadReport = async (type) => {
  const response = await axios.get(`http://localhost:5000/api/reports/${type}`, {
    responseType: 'blob'
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${type}_report.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const ReportDownload = () => (
  <div>
    <button onClick={() => downloadReport('daily')}>Download Daily Report</button>
    <button onClick={() => downloadReport('monthly')}>Download Monthly Report</button>
  </div>
);

export default ReportDownload;
