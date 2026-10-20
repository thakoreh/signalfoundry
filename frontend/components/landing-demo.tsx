import { Icon } from "./icons";

const examples = [
  {
    business: "Example studio",
    website: "studio.example",
    email: "hello@studio.example",
    status: "Unverified",
  },
  {
    business: "Example clinic",
    website: "clinic.example",
    email: "No email available",
    status: "Not available",
  },
];

export default function LandingDemo() {
  return (
    <section
      className="sf-preview sf-preview-compact"
      aria-labelledby="preview-title"
    >
      <header className="sf-preview-header">
        <div>
          <span className="sf-preview-dot" aria-hidden="true" />
          <strong id="preview-title">
            From discovery to the next conversation
          </strong>
        </div>
        <span className="sf-example-label">Fictional product example</span>
      </header>
      <ol
        className="sf-preview-path"
        aria-label="Customer acquisition workflow"
      >
        <li>
          <span>1</span>Discover
          <Icon name="arrow" size={15} />
        </li>
        <li>
          <span>2</span>Review
          <Icon name="arrow" size={15} />
        </li>
        <li>
          <span>3</span>Conversations
          <Icon name="arrow" size={15} />
        </li>
        <li>
          <span>4</span>Meetings
        </li>
      </ol>
      <div className="sf-preview-body">
        <aside
          className="sf-preview-profile"
          aria-label="Example business profile"
        >
          <span className="sf-preview-icon">
            <Icon name="globe" size={23} />
          </span>
          <p className="sf-preview-overline">Your SaaS</p>
          <h3>Appointment scheduling software</h3>
          <div className="sf-example-website">
            <Icon name="globe" size={14} />
            <span>yourbusiness.example</span>
          </div>
          <dl>
            <div>
              <dt>What you offer</dt>
              <dd>Let clients book appointments online</dd>
            </div>
            <div>
              <dt>Businesses to look for</dt>
              <dd>Studios and clinics offering appointments</dd>
            </div>
          </dl>
          <p className="sf-preview-editable">
            <Icon name="check" size={13} />
            You review and edit this first.
          </p>
        </aside>
        <div className="sf-preview-results">
          <div className="sf-preview-results-header">
            <div>
              <p className="sf-preview-overline">Your shortlist</p>
              <h3>Choose a business. Keep the next step.</h3>
            </div>
            <span className="sf-csv-label">
              <Icon name="download" size={14} />
              CSV export
            </span>
          </div>
          <div className="sf-preview-table-wrap">
            <table role="table">
              <caption className="sf-sr-only">
                Illustrative customer list. The example businesses and email are
                fictional and are not live results.
              </caption>
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader" scope="col">
                    Company
                  </th>
                  <th role="columnheader" scope="col">
                    Email
                  </th>
                  <th role="columnheader" scope="col">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {examples.map((item) => (
                  <tr key={item.website} role="row">
                    <td role="cell" data-label="Company">
                      <strong>{item.business}</strong>
                      <span>{item.website}</span>
                    </td>
                    <td role="cell" data-label="Email">
                      <span className="sf-demo-email">{item.email}</span>
                    </td>
                    <td role="cell" data-label="Status">
                      <span className="sf-email-status">{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="sf-demo-draft" open>
            <summary>
              <Icon name="mail" size={16} />
              <span>Review your introduction</span>
              <span className="sf-demo-draft-example">
                Example studio · fictional preview
              </span>
              <Icon name="down" size={14} />
            </summary>
            <div className="sf-demo-draft-content">
              <p className="sf-demo-draft-subject">
                <strong>Subject</strong> Online appointment booking for Example
                studio
              </p>
              <p>Hi Example studio team,</p>
              <p>
                Our scheduling software lets clients book appointments online.
                If that would be useful for your studio, would you be open to a
                quick look?
              </p>
              <p className="sf-demo-draft-note">
                Edit and approve the exact message in your workspace. Copy it to
                your email tool and send it yourself. Nothing is sent here.
              </p>
            </div>
          </details>
          <div
            className="sf-demo-conversation"
            aria-label="Fictional manually reported progress for Example studio"
          >
            <div className="sf-demo-conversation-heading">
              <strong>Example studio</strong>
              <span>Fictional progress · entered by the user</span>
            </div>
            <dl>
              <div>
                <dt>Review</dt>
                <dd>Approved message · sent externally</dd>
              </div>
              <div>
                <dt>Conversations</dt>
                <dd>Interested reply · added manually</dd>
              </div>
              <div>
                <dt>Meetings</dt>
                <dd>Booked · reported by the user</dd>
              </div>
            </dl>
            <p>
              Reply, meeting, and customer outcomes are recorded by you. There
              is no inbox or calendar connection.
            </p>
          </div>
        </div>
      </div>
      <p className="sf-preview-note">
        <Icon name="info" size={13} />
        <span>
          Illustrative layout, not live results. All businesses, the .example
          email, message, reply, and meeting are fictional. Real searches may
          return fewer than five businesses; contact details vary.
        </span>
      </p>
    </section>
  );
}
