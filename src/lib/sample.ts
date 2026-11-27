/**
 * Synthetic sample record.
 * Contains every supported PII category, repeated entities (to show
 * consistent pseudonymization), an invalid Luhn candidate (must be
 * rejected), and ordinary numbers that are NOT PII.
 */
export const SAMPLE_DOCUMENT = `Redacta — Customer Onboarding Record
Synthetic sample for the privacy engine. All values are fictional.

Customer: Aarav Sharma
Email: aarav.sharma@example.com
Alternate email: aarav.sharma@example.com
Support contact: +91 98765 43210
Mobile: 9876543210
Server IPv4: 192.168.1.45
Gateway IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
PAN: ABCDE1234F
Aadhaar: 2345 6789 0123
Payment card: 4111 1111 1111 1111
Legacy card (invalid): 4111 1111 1111 1112
Order ID: 12345
Invoice year: 2024
Amount: 1500 INR

Notes: The customer email and phone appear twice above to show
consistent pseudonymization. The legacy card fails Luhn validation and
must be rejected. Ordinary numbers such as 12345 and 2024 are not PII.`;

export const SAMPLE_FILENAME = 'customer-record-sample.txt';

export const SAMPLE_CSV = `name,email,phone,pan,card,note
Aarav Sharma,aarav.sharma@example.com,+91 98765 43210,ABCDE1234F,4111 1111 1111 1111,"VIP, priority"
Priya Nair,priya.nair@example.com,9812345678,FGHIJ5678K,5500 0055 5555 5559,"Standard, review"`;

export const SAMPLE_CSV_FILENAME = 'customers-sample.csv';

/** Short record used by the scroll-driven hero on the landing page. */
export const HERO_RECORD = `CUSTOMER RECORD — synthetic
Ticket      #48213, refund request
Email       aarav.sharma@example.com
Phone       +91 98765 43210
PAN         ABCDE1234F
Aadhaar     2345 6789 0123
Card        4111 1111 1111 1111
Server IP   192.168.1.45
Note        Call back on 9876543210 after 6 pm.`;

/** Short message used by the redaction-modes section on the landing page. */
export const MODES_SNIPPET = `From: priya.nair@example.com
To:   support@example.com
Re:   Refund for card ending 5559

Hi team, please refund 5500 0055 5555 5559.
My PAN is FGHIJ5678K. Reach me on
9812345678 or priya.nair@example.com.
Sent from 10.0.4.17`;
