const fs = require('fs');
const path = require('path');

const outputDir = __dirname;

const pages = [
  { file: 'ActivityReimbursement.tsx', title: 'Activity Reimbursement', desc: 'Manage and track activity-related expenses and reimbursements' },
  { file: 'ActivityTracker.tsx', title: 'Activity Tracker', desc: 'Track daily activities, tasks, and work plans' },
  { file: 'Approvals.tsx', title: 'Approvals', desc: 'Approve or reject work plans, travel claims, and activities' },
  { file: 'BusinessLogic.tsx', title: 'Business Logic', desc: 'View and test business rules, formulas, and validations' },
  { file: 'Contacts.tsx', title: 'Contacts', desc: 'Manage distributor, retailer, and farmer contacts' },
  { file: 'Dashboard.tsx', title: 'Dashboard', desc: 'Overview of key metrics, performance, and activities' },
  { file: 'DistributorDetails.tsx', title: 'Distributor Details', desc: 'Detailed view of distributor information and inventory' },
  { file: 'FieldVisits.tsx', title: 'Field Visits', desc: 'Schedule and track field visits to distributors and retailers' },
  { file: 'Liquidation.tsx', title: 'Liquidation', desc: 'Track stock liquidation from distributors to farmers' },
  { file: 'LiquidationReports.tsx', title: 'Liquidation Reports', desc: 'Detailed reports on liquidation by product, SKU, and geography' },
  { file: 'LiquidationSimple.tsx', title: 'Liquidation Simple', desc: 'Simplified view of liquidation data' },
  { file: 'MDOModule.tsx', title: 'MDO Module', desc: 'Market Development Officer specific activities and planning' },
  { file: 'MobileAppDesign.tsx', title: 'Mobile App Design', desc: 'Mobile application interface design and preview' },
  { file: 'MobileAppPage.tsx', title: 'Mobile App', desc: 'Mobile-optimized application interface' },
  { file: 'Notifications.tsx', title: 'Notifications', desc: 'View and manage system notifications and alerts' },
  { file: 'Performance.tsx', title: 'Performance', desc: 'Track performance metrics and KPIs' },
  { file: 'Planning.tsx', title: 'Planning', desc: 'Create and manage monthly work plans' },
  { file: 'Profile.tsx', title: 'Profile', desc: 'User profile and settings' },
  { file: 'Reports.tsx', title: 'Reports', desc: 'Comprehensive reports on liquidation, sales, and inventory' },
  { file: 'RetailerInventory.tsx', title: 'Retailer Inventory', desc: 'View and manage retailer stock levels' },
  { file: 'RetailerLiquidation.tsx', title: 'Retailer Liquidation', desc: 'Track liquidation at retailer level' },
  { file: 'RetailerStockLiquidation.tsx', title: 'Retailer Stock Liquidation', desc: 'Manage retailer stock liquidation process' },
  { file: 'RetailerStockVerification.tsx', title: 'Retailer Stock Verification', desc: 'Verify and update retailer stock with e-signature' },
  { file: 'SalesOrders.tsx', title: 'Sales Orders', desc: 'Create and track sales orders' },
  { file: 'SupportTickets.tsx', title: 'Support Tickets', desc: 'Manage support tickets and help requests' },
  { file: 'TechnicalDocumentation.tsx', title: 'Technical Documentation', desc: 'System technical documentation and API details' },
  { file: 'TestPage.tsx', title: 'Test Page', desc: 'Testing and development page' },
  { file: 'TravelClaimApprovals.tsx', title: 'Travel Claim Approvals', desc: 'Approve or reject travel expense claims' },
  { file: 'TravelReimbursement.tsx', title: 'Travel Reimbursement', desc: 'Submit and track travel reimbursement claims' },
  { file: 'UserManagement.tsx', title: 'User Management', desc: 'Manage system users, roles, and permissions' },
  { file: 'WorkPlan.tsx', title: 'Work Plan', desc: 'Create and manage work plans and activities' },
  { file: 'WorkPlanManagement.tsx', title: 'Work Plan Management', desc: 'Manage and approve work plans across teams' }
];

const generateDryCodePage = (pageInfo) => {
  const componentName = pageInfo.file.replace('.tsx', 'DryCode');

  return `import React from 'react';
import { FileText, Calendar, Users, TrendingUp, Search, Filter, Download, Plus } from 'lucide-react';

/**
 * ${pageInfo.title} - DRY CODE VERSION
 *
 * Description: ${pageInfo.desc}
 *
 * NOTE: This is a DRY CODE VERSION for audit purposes only.
 * All functionality, API calls, and business logic have been removed.
 * This shows only the UI structure and layout.
 */

const ${componentName}: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">${pageInfo.title}</h1>
          <p className="text-sm text-gray-600 mt-1">${pageInfo.desc}</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add New
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">--</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600">--</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">--</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Users</p>
              <p className="text-2xl font-bold text-purple-600">--</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Table</h2>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">#{i.toString().padStart(3, '0')}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">Sample Item {i}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">2025-11-06</td>
                    <td className="py-3 px-4">
                      <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-600">Showing 1 to 5 of 5 entries</p>
            <div className="flex gap-2">
              <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm" disabled>
                Previous
              </button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm">1</button>
              <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm" disabled>
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dry Code Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>DRY CODE Version:</strong> This is a non-functional UI mockup for audit purposes.
          All data displayed is static and no backend integration is active.
        </p>
      </div>
    </div>
  );
};

export default ${componentName};
`;
};

console.log('Generating dry code pages...\n');

pages.forEach((page) => {
  const content = generateDryCodePage(page);
  const filename = page.file.replace('.tsx', 'DryCode.tsx');
  fs.writeFileSync(path.join(outputDir, filename), content);
  console.log(`✓ Generated ${filename}`);
});

console.log(`\n✓ All ${pages.length} dry code pages generated successfully!`);
console.log(`Output directory: ${outputDir}`);
