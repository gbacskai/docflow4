#!/bin/bash

# Test Runner for DocFlow4
# This script runs various test suites from the project root

echo "🧪 DocFlow4 Test Runner"
echo "======================"

# Function to show usage
show_usage() {
    echo "Usage: $0 [test-type]"
    echo ""
    echo "Available tests:"
    echo "  user-type    Run user type visibility tests (headless)"
    echo "  all          Run all available tests"
    echo "  list         List all available tests"
    echo ""
    echo "Examples:"
    echo "  ./run-tests.sh user-type"
    echo "  ./run-tests.sh all"
}

# Function to list available tests
list_tests() {
    echo "📋 Available Tests:"
    echo "=================="
    echo ""
    echo "🔐 User Type Visibility Tests:"
    echo "  - test-headless-user-type.js (Headless Puppeteer test)"
    echo "  - manual-user-type-test.js (Manual browser console test)"
    echo ""
    echo "🌐 Domain Tests:"
    echo "  - test-domain-selection.js"
    echo "  - test-domain-lifecycle.js"
    echo "  - test-domain-change.js"
    echo ""
    echo "🔑 Authentication Tests:"
    echo "  - test-auth-implementation.js"
    echo "  - test-confirmation-form.js"
    echo ""
    echo "📱 UI Behavior Tests:"
    echo "  - test-search-focus.js"
    echo "  - test-manual-behavior.js"
}

# Function to run user type tests
run_user_type_tests() {
    echo "🔐 Running User Type Visibility Tests..."
    echo "======================================="
    
    cd tests
    
    # Check if headless test exists
    if [ -f "test-headless-user-type.js" ]; then
        echo "🚀 Running headless user type test..."
        ./run-headless-test.sh
        test_result=$?
        
        if [ $test_result -eq 0 ]; then
            echo "✅ User type visibility tests PASSED"
        else
            echo "❌ User type visibility tests FAILED"
            return $test_result
        fi
    else
        echo "❌ Headless user type test not found"
        return 1
    fi
    
    cd ..
}

# Function to run all tests
run_all_tests() {
    echo "🧪 Running All Tests..."
    echo "====================="
    
    # Run user type tests
    run_user_type_tests
    user_type_result=$?
    
    echo ""
    echo "📊 Test Results Summary:"
    echo "======================="
    
    if [ $user_type_result -eq 0 ]; then
        echo "✅ User Type Visibility Tests: PASSED"
    else
        echo "❌ User Type Visibility Tests: FAILED"
    fi
    
    # Return non-zero if any tests failed
    if [ $user_type_result -ne 0 ]; then
        return 1
    fi
    
    echo ""
    echo "🎉 All tests completed!"
    return 0
}

# Main execution
case "$1" in
    "user-type")
        run_user_type_tests
        ;;
    "all")
        run_all_tests
        ;;
    "list")
        list_tests
        ;;
    "")
        show_usage
        ;;
    *)
        echo "❌ Unknown test type: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac

exit $?